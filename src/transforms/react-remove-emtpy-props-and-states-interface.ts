import * as ts from 'typescript';

import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';

export type Factory = helpers.TransformFactoryAndRecompile;

/**
 * Remove empty Props and States Interface
 *
 * @example
 * Before:
 * interface XXXContainerProps {}
 * interface XXXContainerStates {}
 * export default class XXXContainer extends Component<XXXContainerProps,XXXContainerStates>{}
 * After
 * export default class XXXContainer extends Component<{},{}>{}
 */
function reactRemoveEmptyPropsAndStatesInterfaceTransformFactoryFactory(typeChecker: ts.TypeChecker, compilationOptions: CompilationOptions): Factory {
    return function reactRemoveEmptyPropsAndStatesInterfaceTransformFactory(context: ts.TransformationContext) {
            return function reactRemoveEmptyPropsAndStatesInterfaceTransform(sourceFile: ts.SourceFile) {
                const emptyInterfaces: ts.Statement[] = [];
                let statements = sourceFile.statements;
                sourceFile.statements.filter(statement =>{
                    if(ts.isClassDeclaration(statement) || ts.isClassExpression(statement)){
                        if(helpers.isReactComponent(statement, typeChecker)){
                            const expressionWithTypeArguments =    (statement.heritageClauses![0].types[0] as ts.ExpressionWithTypeArguments);
                            if(expressionWithTypeArguments.typeArguments && ts.isIdentifier(expressionWithTypeArguments.expression)){
                                const newTypeArguments = expressionWithTypeArguments.typeArguments.map(typeArgument =>{
                                    if(ts.isTypeReferenceNode(typeArgument) && ts.isIdentifier(typeArgument.typeName)){
                                        const referenceName = typeArgument.typeName.text;
                                        const referenceInterfaceNodes =  sourceFile.statements.filter(s=> ts.isInterfaceDeclaration(s) && ts.isIdentifier(s.name) && s.name.text === referenceName && s.members.length ===0);
                                        if(referenceInterfaceNodes && referenceInterfaceNodes.length===1){
                                            const referenceInterfaceNode = referenceInterfaceNodes[0] as ts.InterfaceDeclaration;
                                            emptyInterfaces.push(referenceInterfaceNode);
                                            if(referenceInterfaceNode.heritageClauses!=null && referenceInterfaceNode.heritageClauses.length === 1 && ts.isHeritageClause(referenceInterfaceNode.heritageClauses[0])){
                                                 if(referenceInterfaceNode.heritageClauses[0].types.length==1 && ts.isIdentifier(referenceInterfaceNode.heritageClauses[0].types[0].expression)){
                                                    return ts.createTypeReferenceNode(referenceInterfaceNode.heritageClauses[0].types[0].expression.text, undefined);
                                                 }
                                            }else{
                                                return ts.createTypeLiteralNode(undefined);
                                            }
                                        }
                                    }
                                    return typeArgument;
                                });

                                const newHeritageClauses = [ts.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [ts.createExpressionWithTypeArguments(newTypeArguments, ts.createIdentifier(expressionWithTypeArguments.expression.text))])];
                                if(ts.isClassDeclaration(statement)) {
                                    const  newStatement = ts.updateClassDeclaration(
                                        statement,
                                        statement.decorators,
                                        statement.modifiers,
                                        statement.name,
                                        statement.typeParameters,
                                        newHeritageClauses,
                                        statement.members
                                    );
                                    statements = ts.createNodeArray(helpers.replaceItem(statements, statement, newStatement));
                                }
                            }
                        }
                    }
                    statements = ts.createNodeArray(statements.filter(statement => !emptyInterfaces.includes(statement)));
                });

                const visited = ts.updateSourceFileNode(
                    sourceFile,
                    statements,
                );
                ts.addEmitHelpers(visited, context.readEmitHelpers());
                return visited;
            };
        }
}

export default {
    recompile: false,
    factory: reactRemoveEmptyPropsAndStatesInterfaceTransformFactoryFactory,
}