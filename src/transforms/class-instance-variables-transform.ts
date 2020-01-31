import * as ts from 'typescript';
import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';
import { TransformFactoryAndRecompile } from '../helpers';

export type Factory = helpers.TransformFactoryAndRecompile;

let compilationOptions:CompilationOptions;

/**
 * declare class variables
 *
 * @example
 * Before:
 * class a {
 *    constructor(){
 *      this.name = ''
 *    }
 * }
 *
 * After
 * class a {
 *    name: string
 *    constructor(){
 *      this.name = ''
 *    }
 * }
 */
function classInstanceVariablesTransformFactoryFactory(typeChecker: ts.TypeChecker, _compilationOptions: CompilationOptions): Factory {
    compilationOptions = _compilationOptions;
    return  function classInstanceVariablesTransformFactory(context: ts.TransformationContext) {
            return function classInstanceVariablesTransform(sourceFile: ts.SourceFile) {
                const visited = visitSourceFile(sourceFile, typeChecker);
                ts.addEmitHelpers(visited, context.readEmitHelpers());

                return visited;
            };
        }
}

function visitSourceFile(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker) {
    helpers.visitor(sourceFile.statements, statement => {
        if (ts.isClassExpression(statement) || ts.isClassDeclaration(statement)) {
            const propertyDeclaration = getInstancePropertiesFromClassStatement(statement, typeChecker, sourceFile);
            statement.members = ts.createNodeArray([...propertyDeclaration, ...statement.members]);
        }
    });

    return sourceFile;
}

// 获取 ref 回调中定义的 成员变量，如  textInput
// <TextInput ref={(textInput) => { this.textInput = textInput; }}
function getRefNames(statement: ts.ClassExpression | ts.ClassDeclaration, typeChecker: ts.TypeChecker) {
    const propertyNames = new Array<string>();
    if((ts.isClassDeclaration(statement) || ts.isClassExpression(statement)) && helpers.isReactComponent(statement,typeChecker)) {
        helpers.filter<ts.JsxAttribute>(statement.members, node => {
            return ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'ref'
        }).forEach(refAttributes => {
            if (refAttributes.initializer
                && ts.isJsxExpression(refAttributes.initializer)
                && refAttributes.initializer.expression
                && ts.isArrowFunction(refAttributes.initializer.expression)
                && refAttributes.initializer.expression.parameters.length === 1
                && ts.isParameter(refAttributes.initializer.expression.parameters[0])
                && ts.isIdentifier(refAttributes.initializer.expression.parameters[0].name)) {
                const refName = refAttributes.initializer.expression.parameters[0].name.text;

                helpers.filterEachNode<ts.BinaryExpression>(refAttributes.initializer.expression.body, ts.isBinaryExpression)
                        .filter(be => be.operatorToken.kind == ts.SyntaxKind.EqualsToken && ts.isIdentifier(be.right) && be.right.text === refName)
                        .map(be=>be.left)
                        .forEach(n => {
                            if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.name) && n.expression.kind == ts.SyntaxKind.ThisKeyword) {
                                const propertyName = n.name.text;
                                propertyNames.push(propertyName);
                            }
                        });
            }
        });
    }
    return propertyNames;
}


/**
 * Get properties within constructor
 * @param classStatement
 * @param typeChecker
 */
function getInstancePropertiesFromClassStatement(
    classStatement: ts.ClassExpression | ts.ClassDeclaration,
    typeChecker: ts.TypeChecker,
    sourceFile: ts.SourceFile,
): Array<ts.PropertyDeclaration> {
    const propertyDeclarations: Array<ts.PropertyDeclaration> = [];
    const propertyRefNames = getRefNames(classStatement, typeChecker);
    let constructorStartIndex = -1;
    let constructorEndIndex = -1;
    classStatement.members.forEach(member => {
        if(ts.isConstructorDeclaration(member)){
            constructorStartIndex = member.getStart();
            constructorEndIndex = member.getEnd();
        }
    });

    const memberNames =  typeChecker.getTypeAtLocation(classStatement).getProperties().map(propertyName=>propertyName.name);
    const expressions = helpers.filter<ts.BinaryExpression>(
        classStatement.members,
        ts.isBinaryExpression,
    );

    expressions.forEach((expression: ts.BinaryExpression) => {
        //  this.onComplete = this._onComplete.bind(this);
        if(expression.operatorToken.kind ==ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(expression.left) && expression.left.expression.kind==ts.SyntaxKind.ThisKeyword ){
            let isRequired = expression.getStart()>=constructorStartIndex && expression.getEnd()<=constructorEndIndex;
            const propertyName = expression.left.name.text;
            let   type = typeChecker.getTypeAtLocation(expression.right);
            //this._onComplete.bind(this);
            if(ts.isCallExpression(expression.right)){
                const callText = expression.right.getText();
                let match = callText.match(/^this\.(\w+)\.bind\(this\)/);
                if(match) {
                    type = typeChecker.getTypeAtLocation((expression.right.expression as ts.PropertyAccessExpression).expression);
                }
            }

            if (!memberNames.includes(propertyName) &&
                !propertyDeclarations.find(p => (p.name as ts.Identifier).text === propertyName)
            ) {
                let  typeNode = helpers.typeToTypeNode(type, typeChecker);
                if(typeNode && ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName) && propertyRefNames.includes(propertyName)){
                    // 如果是 ref 成员变量，需要添加额外的null, 如 private textInput?: TextInput | null;
                    typeNode = ts.createUnionOrIntersectionTypeNode(ts.SyntaxKind.UnionType, [typeNode, ts.createKeywordTypeNode(ts.SyntaxKind.NullKeyword)]);
                }
                if(typeNode){
                    if(typeNode.kind==ts.SyntaxKind.AnyKeyword){
                        isRequired = true;
                    }
                }else{
                    isRequired = true;
                }

                const propertyDeclaration = ts.createProperty(
                    [], // decorator
                    compilationOptions.privatePropertyName ? ts.createModifiersFromModifierFlags(ts.ModifierFlags.Private) : undefined, // modifier  todo 用户可设置是否默认为private访问权限
                    propertyName,
                    isRequired ? undefined : ts.createToken(ts.SyntaxKind.QuestionToken),
                    typeNode,
                    undefined,
                );
                propertyDeclarations.push(propertyDeclaration);
            }
        }
    });

    propertyDeclarations.sort(function(a, b) {
        const n = (a.name as ts.Identifier).text;
        const m = (b.name as ts.Identifier).text;
        if (n > m) return 1;
        if (n < m) return -1;
        return 0;
    });
    return propertyDeclarations;
}

export default  {
    recompile: false,
    factory:  classInstanceVariablesTransformFactoryFactory,
}
