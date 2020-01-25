import * as ts from 'typescript';
import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';

export type Factory = ts.TransformerFactory<ts.SourceFile>;

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
export function classInstanceVariablesTransformFactoryFactory(typeChecker: ts.TypeChecker, _compilationOptions: CompilationOptions): Factory {
    compilationOptions = _compilationOptions;
    return function classInstanceVariablesTransformFactory(context: ts.TransformationContext) {
        return function classInstanceVariablesTransform(sourceFile: ts.SourceFile) {
            const visited = visitSourceFile(sourceFile, typeChecker);
            ts.addEmitHelpers(visited, context.readEmitHelpers());

            return visited;
        };
    };
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

    const className = helpers.getComponentExtend(classStatement, typeChecker);
    const isReactClass = helpers.isReactComponent(classStatement, typeChecker, compilationOptions);
    // if(!isReactClass){
    //     return [];
    // }

    const propertyDeclarations: Array<ts.PropertyDeclaration> = [];
    const memberTypes = new Map<string,ts.Type>();

    const memberNames = new Array<string>();


    let constructorStartIndex = -1;
    let constructorEndIndex = -1;

    classStatement.members.forEach(member => {
        if(ts.isConstructorDeclaration(member)){
            constructorStartIndex = member.getStart();
            constructorEndIndex = member.getEnd();
        }
        if(member.name && ts.isIdentifier(member.name) && member.name.text){
            memberTypes.set(member.name.text,typeChecker.getTypeAtLocation(member));
            memberNames.push(member.name.text);
        }
    });
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
            let referenceType = '';
            //this._onComplete.bind(this);
            if(ts.isCallExpression(expression.right)){
                const callText = expression.right.getText();
                let match = callText.match(/^this\.(\w+)\.bind\(this\)/);
                if(match) {
                    type = memberTypes.get(match[1])!;
                }else{
                    if(compilationOptions.classProperty && className){
                        const referenceName =  compilationOptions.classProperty.customReferenceType(className, callText);
                        if(referenceName){
                            referenceType = referenceName;
                        }
                    }
                }
            }

            let isValidPropertyName = true;
            if(compilationOptions.classProperty && className){
                isValidPropertyName =  compilationOptions.classProperty.propertyNameValidator(className, propertyName);
            }

            const process = isReactClass
                ? propertyName.toLowerCase() !== 'state' &&
                  propertyName.toLowerCase() !== 'props' &&
                  propertyName.toLowerCase() !== 'setstate' &&
                  isValidPropertyName
                : isValidPropertyName;

            if (
                process &&
                !memberNames.find(name => name === propertyName) &&
                !propertyDeclarations.find(p => (p.name as ts.Identifier).text === propertyName)
            ) {
                const typeString = typeChecker.typeToString(type);
                let typeNode:ts.TypeNode | undefined = undefined;
                if(referenceType){
                    typeNode = ts.createTypeReferenceNode(referenceType, []);
                }else if (typeString === 'ReactNode') {
                    typeNode = ts.createTypeReferenceNode('React.ReactNode', []);
                } else if (typeString === 'undefined[]') {
                    typeNode = ts.createArrayTypeNode(ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
                } else if (typeString === 'false' || typeString === 'true') {
                    typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
                } else if (typeString === 'Timer' || (type && type.flags === ts.TypeFlags.NumberLiteral)) {
                    typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
                } else if (typeString.match(/"\w{0,}"/)) {
                    typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
                } else {
                    typeNode = typeChecker.typeToTypeNode(type);
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
                    ts.createModifiersFromModifierFlags(ts.ModifierFlags.Private), // modifier
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

    // const hasDefaultProps = memberNames.find(value => value == 'defaultProps');
    // if(hasDefaultProps) {
    //     const className = classStatement && classStatement.name && classStatement.name.getText(sourceFile);
    //     const propsTypes = ts.createIntersectionTypeNode([
    //         ts.createTypeReferenceNode(`${className}Props`, []),
    //         ts.createTypeReferenceNode(`typeof ${className}.defaultProps`, []),
    //     ]);
    //     const propertyDeclaration = ts.createProperty(
    //         [], // decorator
    //         [], // modifier
    //         "props",
    //         ts.createToken(ts.SyntaxKind.ExclamationToken),
    //         propsTypes,
    //         undefined,
    //     );
    //     propertyDeclarations.push(propertyDeclaration);
    // }

    return propertyDeclarations;
}
