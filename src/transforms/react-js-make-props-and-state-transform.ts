import * as ts from 'typescript';
import * as _ from 'lodash';
import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';

export type Factory = helpers.TransformFactoryAndRecompile;

let compilationOptions: CompilationOptions;

/**
 * Get transform for transforming React code originally written in JS which does not have
 * props and state generic types
 * This transform will remove React component static "propTypes" member during transform
 */
function reactJSMakePropsAndStateInterfaceTransformFactoryFactory(typeChecker: ts.TypeChecker, _compilationOptions: CompilationOptions): Factory {
    compilationOptions = _compilationOptions;
    return function reactJSMakePropsAndStateInterfaceTransformFactory(context: ts.TransformationContext) {
        return function reactJSMakePropsAndStateInterfaceTransform(sourceFile: ts.SourceFile) {
            const visited = visitSourceFile(sourceFile, typeChecker, compilationOptions);
            ts.addEmitHelpers(visited, context.readEmitHelpers());

            return visited;
        }
    }
}

function visitSourceFile(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker, compilationOptions: CompilationOptions) {
    let newSourceFile = sourceFile;
    for (const statement of sourceFile.statements) {
        if (ts.isClassDeclaration(statement) && helpers.isReactComponent(statement, typeChecker)) {
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

    const propTypeName = `${className}Props`;
    const stateTypeName = `${className}States`;

    let interfaceMembers = _.unionBy([...propType.members, ...props], p =>
        p.name ? (p.name as ts.Identifier).text : '',
    );
    // remove parent interface properties
    const superInterfaceMembers = getProperties(propTypeName, sourceFile, typeChecker);
    interfaceMembers = interfaceMembers.filter(member => {
        if (member.name && ts.isIdentifier(member.name) && superInterfaceMembers.includes(member.name.text)) {
            return false;
        }
        return true;
    });
    const superStateMembers = getProperties(stateTypeName, sourceFile, typeChecker);
    const states = getStatesOfReactComponentClass(classDeclaration, typeChecker, superStateMembers);

    let propsInterfaceStatement = getInterfaceStatement(propTypeName, sourceFile)!;
    let newPropsInterfaceStatement = ts.updateInterfaceDeclaration(
        propsInterfaceStatement,
        propsInterfaceStatement.decorators,
        propsInterfaceStatement.modifiers,
        propsInterfaceStatement.name,
        propsInterfaceStatement.typeParameters,
        propsInterfaceStatement.heritageClauses,
        interfaceMembers,
    );
    let statements = helpers.replaceItem(sourceFile.statements, propsInterfaceStatement, newPropsInterfaceStatement);

    let stateInterfaceStatement = getInterfaceStatement(stateTypeName, sourceFile)!;
    let newStateInterfaceStatement = ts.updateInterfaceDeclaration(
        stateInterfaceStatement,
        stateInterfaceStatement.decorators,
        stateInterfaceStatement.modifiers,
        stateInterfaceStatement.name,
        stateInterfaceStatement.typeParameters,
        stateInterfaceStatement.heritageClauses,
        states,
    );
    statements = helpers.replaceItem(statements, stateInterfaceStatement, newStateInterfaceStatement);

    const propTypeRef = ts.createTypeReferenceNode(propTypeName, []);
    const stateTypeRef = ts.createTypeReferenceNode(stateTypeName, []);
    let newClassDeclaration = getNewReactClassDeclaration(
        classDeclaration,
        propTypeRef,
        stateTypeRef,
    );

    statements = helpers.replaceItem(statements, classDeclaration, newClassDeclaration);
    return ts.updateSourceFileNode(sourceFile, ts.createNodeArray(statements));
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
function fixPropsInterface(typeLiteralNode: ts.TypeLiteralNode, defaultPropsKeys: Array<string>): ts.TypeLiteralNode {
    const members = typeLiteralNode.members.map(member => {
        if (member.name && ts.isIdentifier(member.name) && defaultPropsKeys.indexOf(member.name.text) >= 0) {
            member.questionToken = undefined;
        }
        return member;
    });
    return ts.createTypeLiteralNode(members);
}

function getClassName(classDeclaration: ts.ClassDeclaration) {
    if (classDeclaration && classDeclaration.name) {
        return classDeclaration.name.text;
    }
    return undefined;
}

function getInterfaceStatement(interfaceName: string, sourceFile: ts.SourceFile): ts.InterfaceDeclaration | undefined {
    let interfaceStatement: ts.InterfaceDeclaration | undefined = undefined;
    sourceFile.statements.forEach(statement => {
        if (ts.isInterfaceDeclaration(statement) && statement.name && statement.name.text === interfaceName) {
            interfaceStatement = statement;
        }
    });
    return interfaceStatement;
}

function getProperties(interfaceName: string, sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker): Array<string> {
    const array = new Array<string>();
    const statement = getInterfaceStatement(interfaceName, sourceFile);
    if (statement && ts.isInterfaceDeclaration(statement)) {
        typeChecker.getTypeAtLocation(statement).getProperties().forEach(member => {
            array.push(member.name);
        })
    }
    return array;
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
        return fixPropsInterface(helpers.buildInterfaceFromPropTypeObjectLiteral(staticPropTypesMember.initializer), defaultPropsKeys);
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
            return fixPropsInterface(helpers.buildInterfaceFromPropTypeObjectLiteral(returnStatement.expression), defaultPropsKeys);
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
    superStateMembers: Array<string>
) {
    const members: ts.PropertySignature[] = [];
    const addMember = (name: ts.Identifier, required: boolean = false) => {
        const text = name ? name.text : '';
        if (text && !members.find(m => (m.name as ts.Identifier).text === text) && !superStateMembers.includes(text)) {
            const type = typeChecker.getTypeAtLocation(name);
            let typeNode = typeChecker.typeToTypeNode(type);
            const typeStr = typeChecker.typeToString(type);
            if (["true", "false"].includes(typeStr)) {
                typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
            } else if (["undefined", "null"].includes(typeStr)) {
                typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
            }
            const member = ts.createPropertySignature(
                [],
                text,
                required ? undefined : ts.createToken(ts.SyntaxKind.QuestionToken),
                typeNode,
                undefined,
            );
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
            objectLiteral.properties.forEach((p) => {
                if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
                    addMember(p.name, true);
                }
            });
        });

        // constructor  Object.assing(this.state , {})
        const objectAssignState = helpers.filter<ts.ExpressionStatement>(node, helpers.isObjectAssignState);
        objectAssignState.forEach(s => {
            const expression = s.expression as ts.CallExpression;
            const objectLiteral = expression.arguments[1] as ts.ObjectLiteralExpression;
            objectLiteral.properties.forEach((p) => {
                if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
                    addMember(p.name, true);
                }
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
            if (ts.isPropertyAccessExpression(n) && isThisState(n.expression)) {
                return true;
            }
            return false;
        });

        propertyAccessExpressions.forEach(p => {
            addMember(p.name, false);
        });
    }

    return members;
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
        if (ts.isPropertyAccessExpression(node) && isThisProps(node.expression)) {
            propertyAccessExpressions.push(node);
        } else {
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

export default {
    recompile: false,
    factory: reactJSMakePropsAndStateInterfaceTransformFactoryFactory,
}
