import * as ts from 'typescript';
import * as _ from 'lodash';
import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';

export type Factory = ts.TransformerFactory<ts.SourceFile>;

let compilationOptions: CompilationOptions;

/**
 * Get transform for transforming React code originally written in JS which does not have
 * props and state generic types
 * This transform will remove React component static "propTypes" member during transform
 */
export function reactJSMakePropsAndStateInterfaceTransformFactoryFactory(typeChecker: ts.TypeChecker, _compilationOptions: CompilationOptions): Factory {
    compilationOptions = _compilationOptions;
    return function reactJSMakePropsAndStateInterfaceTransformFactory(context: ts.TransformationContext) {
        return function reactJSMakePropsAndStateInterfaceTransform(sourceFile: ts.SourceFile) {
            const visited = visitSourceFile(sourceFile, typeChecker, compilationOptions);
            ts.addEmitHelpers(visited, context.readEmitHelpers());

            return visited;
        };
    };
}

function visitSourceFile(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker, compilationOptions: CompilationOptions) {
    let newSourceFile = sourceFile;
    for (const statement of sourceFile.statements) {
        if (ts.isClassDeclaration(statement) && helpers.isReactComponent(statement, typeChecker, compilationOptions)) {
            newSourceFile = visitReactClassDeclaration(statement, newSourceFile, typeChecker);
        }
    }

    return newSourceFile;
}

function visitReactClassDeclaration(
    classDeclaration: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    typeChecker: ts.TypeChecker,
) {
    if (!classDeclaration.heritageClauses || !classDeclaration.heritageClauses.length) {
        return sourceFile;
    }
    const className = classDeclaration && classDeclaration.name && classDeclaration.name.getText(sourceFile);
    const propType = getPropsTypeOfReactComponentClass(classDeclaration, sourceFile); // qwert
    const props = getPropsOfReactComponentClass(classDeclaration, sourceFile);
    const interfaceMembers = _.unionBy([...propType.members, ...props], p =>
        p.name ? (p.name as ts.Identifier).text : '',
    );
    const states = getStatesOfReactComponentClass(classDeclaration, typeChecker);
    let shouldMakePropTypeDeclaration = interfaceMembers.length > 0;
    let shouldMakeStateTypeDeclaration = !isStateMemberEmpty(states);
    const propTypeName = `${className}Props`;
    const stateTypeName = `${className}State`;

    const extendFrom = helpers.getComponentExtend(classDeclaration, typeChecker)!;
    const customExtend = !["React.Component","Component"].includes(extendFrom);
    shouldMakePropTypeDeclaration = shouldMakePropTypeDeclaration || customExtend;
    shouldMakeStateTypeDeclaration = shouldMakeStateTypeDeclaration || customExtend;

    let interfaceHeritageClause = customExtend ? [createInterfaceHeritageClause()] : undefined;
    let propsInterfaceDeclaration: ts.Statement = ts.createInterfaceDeclaration(
        [],
        [],
        propTypeName,
        [],
        interfaceHeritageClause,
        interfaceMembers,
    );

    if(interfaceMembers.length==0 && customExtend){
        propsInterfaceDeclaration =  ts.createTypeAliasDeclaration([], [], propTypeName, [], ts.createTypeReferenceNode('Props',[]));
    }

    let statesHeritageClause = customExtend ?  [createStatesHeritageClause()] : undefined;
    let statesInterfaceDeclaration: ts.Statement = ts.createInterfaceDeclaration(
        [],
        [],
        stateTypeName,
        [],
        statesHeritageClause,
        (states as ts.TypeLiteralNode).members,
    );

    if((states as ts.TypeLiteralNode).members.length==0 && customExtend){
        statesInterfaceDeclaration =  ts.createTypeAliasDeclaration([], [], stateTypeName, [], ts.createTypeReferenceNode('States',[]));
    }

    const propTypeRef = ts.createTypeReferenceNode(propTypeName, []);
    const stateTypeRef = ts.createTypeReferenceNode(stateTypeName, []);

    let newClassDeclaration = getNewReactClassDeclaration(
        classDeclaration,
        shouldMakePropTypeDeclaration ? propTypeRef : ts.createTypeLiteralNode([]),
        shouldMakeStateTypeDeclaration ? stateTypeRef : ts.createTypeLiteralNode([]),
    );

    const allTypeDeclarations = [];
    if (shouldMakePropTypeDeclaration) allTypeDeclarations.push(propsInterfaceDeclaration);
    if (shouldMakeStateTypeDeclaration) allTypeDeclarations.push(statesInterfaceDeclaration);

    let statements = helpers.insertBefore(sourceFile.statements, classDeclaration, allTypeDeclarations);
    statements = helpers.replaceItem(statements, classDeclaration, newClassDeclaration);

    if(customExtend){
        const importDeclarations = statements.filter(statement=>{
            return  ts.isImportDeclaration(statement) && statement.importClause && statement.importClause.name && ts.isIdentifier(statement.importClause.name) && statement.importClause.name.text===extendFrom;
        }).forEach(statement =>{
            const importDeclaration = statement as ts.ImportDeclaration;
            if(importDeclaration.importClause) {

                let added =   [
                    ts.createImportSpecifier(undefined, ts.createIdentifier('Props')),
                    ts.createImportSpecifier(undefined, ts.createIdentifier('States'))
                ];

               if(importDeclaration.importClause.namedBindings &&  ts.isNamedImports(importDeclaration.importClause.namedBindings)){
                   // importDeclaration.importClause.namedBindings.element
                   importDeclaration.importClause.namedBindings.elements.forEach(value => {
                       added.push(value);
                   })
               }
                const importClause = ts.updateImportClause(
                    importDeclaration.importClause,
                    importDeclaration.importClause.name,
                    ts.createNamedImports( added)
                );


                const newImportDeclaration = ts.updateImportDeclaration(importDeclaration,
                    importDeclaration.decorators,
                    importDeclaration.modifiers,
                    importClause,
                    importDeclaration.moduleSpecifier);
                statements = helpers.replaceItem(statements, statement, newImportDeclaration);
            }
        });
    }
    return ts.updateSourceFileNode(sourceFile, statements);
}

function getNewReactClassDeclaration(
    classDeclaration: ts.ClassDeclaration,
    propTypeRef: ts.TypeNode,
    stateTypeRef: ts.TypeNode,
) {
    if (!classDeclaration.heritageClauses || !classDeclaration.heritageClauses.length) {
        return classDeclaration;
    }

    const firstHeritageClause = classDeclaration.heritageClauses[0];

    const newFirstHeritageClauseTypes = helpers.replaceItem(
        firstHeritageClause.types,
        firstHeritageClause.types[0],
        ts.updateExpressionWithTypeArguments(
            firstHeritageClause.types[0],
            [propTypeRef, stateTypeRef],
            firstHeritageClause.types[0].expression,
        ),
    );

    const newHeritageClauses = helpers.replaceItem(
        classDeclaration.heritageClauses,
        firstHeritageClause,
        ts.updateHeritageClause(firstHeritageClause, newFirstHeritageClauseTypes),
    );

    return ts.updateClassDeclaration(
        classDeclaration,
        classDeclaration.decorators,
        classDeclaration.modifiers,
        classDeclaration.name,
        classDeclaration.typeParameters,
        newHeritageClauses,
        classDeclaration.members,
    );
}

/**
 * 如果定义了 defaultProps, 并且propTypes对应的key为可选，修复key为必选
 * before=>
static propTypes = {
        productName: PropTypes.string,
    }

 static defaultProps  = {
        productName: 'defaultValue',
    }

 after =>
 interface TestComponentProps {
    productName: string;
}

 * @param typeLiteralNode
 * @param defaultPropsKeys
 */
function fixPropsInterface(typeLiteralNode:ts.TypeLiteralNode, defaultPropsKeys: Array<string>): ts.TypeLiteralNode {
    typeLiteralNode.members.forEach(member =>{
        if(member.name && ts.isIdentifier(member.name) && defaultPropsKeys.indexOf(member.name.text)>=0) {
            member.questionToken = undefined;
        }
    });
    return typeLiteralNode;
}

function getPropsTypeOfReactComponentClass(
    classDeclaration: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
): ts.TypeLiteralNode {
    const staticPropTypesMember = _.find(classDeclaration.members, member => {
        return (
            ts.isPropertyDeclaration(member) &&
            helpers.hasStaticModifier(member) &&
            helpers.isPropTypesMember(member, sourceFile)
        );
    });

    const defaultPropsKeys = helpers.getDefaultPropsByClass(classDeclaration);
    if (
        staticPropTypesMember !== undefined &&
        ts.isPropertyDeclaration(staticPropTypesMember) && // check to satisfy type checker
        staticPropTypesMember.initializer &&
        ts.isObjectLiteralExpression(staticPropTypesMember.initializer)
    ) {
        return fixPropsInterface(helpers.buildInterfaceFromPropTypeObjectLiteral(staticPropTypesMember.initializer),defaultPropsKeys);
    }

    const staticPropTypesGetterMember = _.find(classDeclaration.members, member => {
        return (
            ts.isGetAccessorDeclaration(member) &&
            helpers.hasStaticModifier(member) &&
            helpers.isPropTypesMember(member, sourceFile)
        );
    });

    if (
        staticPropTypesGetterMember !== undefined &&
        ts.isGetAccessorDeclaration(staticPropTypesGetterMember) // check to satisfy typechecker
    ) {
        const returnStatement = _.find(staticPropTypesGetterMember.body!.statements, statement =>
            ts.isReturnStatement(statement),
        );
        if (
            returnStatement !== undefined &&
            ts.isReturnStatement(returnStatement) && // check to satisfy typechecker
            returnStatement.expression &&
            ts.isObjectLiteralExpression(returnStatement.expression)
        ) {
            return  fixPropsInterface(helpers.buildInterfaceFromPropTypeObjectLiteral(returnStatement.expression),defaultPropsKeys);
        }
    }

    return ts.createTypeLiteralNode([]);
}

function isThisState(n: ts.Node): n is ts.PropertyAccessExpression {
   return helpers.isThisProperty(n, "state");
}

function isThisProps(n: ts.Node): n is ts.PropertyAccessExpression {
    return helpers.isThisProperty(n, "props");
}

function getStatesOfReactComponentClass(
    classDeclaration: ts.ClassDeclaration,
    typeChecker: ts.TypeChecker,
): ts.TypeNode {
    const extendFrom = helpers.getComponentExtend(classDeclaration,typeChecker);
    const members: ts.PropertySignature[] = [];
    const addMember = (name: ts.Identifier, required: boolean = false) => {
        const text = name ? name.text : '';
        if (text && !members.find(m => (m.name as ts.Identifier).text === text)) {
            const type = typeChecker.getTypeAtLocation(name);
            let typeNode = typeChecker.typeToTypeNode(type);
            const typeStr = typeChecker.typeToString(type);
            if(["true","false"].includes(typeStr)){
                typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
            }else if(["undefined","null"].includes(typeStr)){
                typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
            }
            const member = ts.createPropertySignature(
                [],
                text,
                required ? undefined : ts.createToken(ts.SyntaxKind.QuestionToken),
                typeNode,
                undefined,
            );
            // console.log("add____"+text);
            if(compilationOptions.react && !compilationOptions.react.stateNameValidator(extendFrom, text)){
                return;
            }

            members.push(member);
        }
    };

    for (const member of classDeclaration.members) {
        const node = [member];

        // constructor this.state = {}
        const initialState = helpers.filter<ts.ExpressionStatement>(node, n => {
            return ts.isExpressionStatement(n) &&
                ts.isBinaryExpression(n.expression) &&
                ts.isObjectLiteralExpression(n.expression.right) &&
                n.expression.left.getText().match(/this\.state/)
                ? true
                : false;
        });

        initialState.forEach(s => {
            const expression = s.expression as ts.BinaryExpression;
            const objectLiteral = expression.right as ts.ObjectLiteralExpression;
            objectLiteral.properties.forEach((p: any) => {
                addMember(p.name, true);
            });
        });

        // constructor  Object.assing(this.state , {})
        const objectAssignState = helpers.filter<ts.ExpressionStatement>(node, helpers.isObjectAssignState);
        objectAssignState.forEach(s => {
            const expression = s.expression as ts.CallExpression;
            const objectLiteral = expression.arguments[1] as ts.ObjectLiteralExpression;
            objectLiteral.properties.forEach((p: any) => {
                addMember(p.name, true);
            });
        });

        // argument of setState
        const setStateArguments = helpers
            .filter<ts.CallExpression>(node, n => {
                return ts.isCallExpression(n) &&
                    n.expression.getText().match(/\.setState/) &&
                    n.arguments[0] &&
                    ts.isObjectLiteralExpression(n.arguments[0])
                    ? true
                    : false;
            })
            .map(n => n.arguments[0] as ts.ObjectLiteralExpression);

        setStateArguments.forEach(arg => {
            arg.properties.forEach((p: any) => {
                addMember(p.name, false);
            });
        });

        // varaible declaration like const { a } = this.state
        const variableDeclarations = helpers.filter<ts.VariableDeclaration>(node, n => {
            return ts.isVariableDeclaration(n) &&
                n.initializer &&
                n.initializer.getText().match(/this\.state/) &&
                n.name &&
                (n.name as any).elements
                ? true
                : false;
        });

        variableDeclarations.forEach(v => {
            (v.name as any).elements.forEach((el: any) => {
                addMember(el.name, false);
            });
        });

        // property access expresion like this.state.a
        const propertyAccessExpressions = helpers.filter<ts.PropertyAccessExpression>(node, n => {
            if(ts.isPropertyAccessExpression(n) && isThisState(n.expression)){
                return true;
            }
            return false;
        });

        propertyAccessExpressions.forEach(p => {
            addMember(p.name, false);
        });
    }

    return ts.createTypeLiteralNode(members);
}

function isStateMemberEmpty(stateType: ts.TypeNode): boolean {
    // Only need to handle TypeLiteralNode & IntersectionTypeNode
    if (ts.isTypeLiteralNode(stateType)) {
        return stateType.members.length === 0;
    }

    if (!ts.isIntersectionTypeNode(stateType)) {
        return true;
    }

    return stateType.types.every(isStateMemberEmpty);
}

/**
 * interface extends React.HTMLAttributes<Element>
 */
function createInterfaceHeritageClause() {
    const expression = ts.createIdentifier('Props');
    // const typeReference = ts.createTypeReferenceNode('Element', []);
    const expressionWithTypeArguments = ts.createExpressionWithTypeArguments(undefined, expression);
    return ts.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [expressionWithTypeArguments]);
}

function createStatesHeritageClause() {
    const expression = ts.createIdentifier('States');
    // const typeReference = ts.createTypeReferenceNode('Element', []);
    const expressionWithTypeArguments = ts.createExpressionWithTypeArguments(undefined, expression);
    return ts.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [expressionWithTypeArguments]);
}

function getPropsOfReactComponentClass(
    classDeclaration: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
): ts.PropertySignature[] {
    const names: string[] = [];

    const variableDeclarations = helpers.filter<ts.VariableDeclaration>(classDeclaration.members, node => {
        return ts.isVariableDeclaration(node) && node.initializer && node.initializer.getText() === 'this.props'
            ? true
            : false;
    });

    variableDeclarations.forEach(node => {
        if ((node.name as any).elements) {
            (node.name as any).elements.forEach((el: ts.BindingElement) => {
                const name = (el.propertyName || el.name) as ts.Identifier;
                names.push(name.text);
            });
        }
    });

    const propertyAccessExpressions: ts.PropertyAccessExpression[] = [];
    function visitEach(node: ts.Node) {
        if(ts.isPropertyAccessExpression(node) && isThisProps(node.expression)){
            propertyAccessExpressions.push(node);
        }else{
            ts.forEachChild(node, visitEach);
        }
    }
    ts.forEachChild(classDeclaration, visitEach);

    propertyAccessExpressions.forEach(node => {
        names.push(node.name.text);
    });

    const propsSignatures = names
        .filter(name => name !== 'children')
        .map(name => {
            return ts.createPropertySignature(
                [],
                name,
                ts.createToken(ts.SyntaxKind.QuestionToken),
                ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
                undefined,
            );
        });
    return propsSignatures;
}
