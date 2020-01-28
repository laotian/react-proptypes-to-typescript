import * as ts from 'typescript';
import { statSync } from 'fs';
import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';
import { CallExpression } from 'typescript';

export type Factory = helpers.TransformFactoryAndRecompile;

/**
 *
 *
 * @example
 * Before:
 *     Object.assign(this.state,{})
 * After
 *    this.state = {}
 */
function objectAssignStateFactoryFactory(typeChecker: ts.TypeChecker, compilationOptions: CompilationOptions): Factory {
    return  function objectAssignStateFactory(context: ts.TransformationContext) {
            return function objectAssignStateTransform(sourceFile: ts.SourceFile) {
                const visited = visitSourceFile(sourceFile, typeChecker);
                ts.addEmitHelpers(visited, context.readEmitHelpers());
                return visited;
            };

            function visitSourceFile(sourceFile: ts.SourceFile, typeCheck: ts.TypeChecker) {
                let statements = sourceFile.statements;
                statements = ts.createNodeArray(statements.map(statement => {
                    if (ts.isClassDeclaration(statement) && helpers.isReactComponent(statement, typeChecker, compilationOptions)) {
                        const extendFrom = helpers.getComponentExtend(statement, typeChecker)!;
                        const customExtend = !["React.Component", "Component"].includes(extendFrom);
                        const members = statement.members.map(member => {
                            if (ts.isConstructorDeclaration(member)) {
                                let block = member.body;
                                if (block) {
                                    let blockStatements = block.statements;
                                    const objectAssignState = helpers.filter(blockStatements, helpers.isObjectAssignState);
                                    if (objectAssignState && objectAssignState.length == 1) {
                                        const objectAssignExpression = objectAssignState[0] as ts.ExpressionStatement;
                                        let objectValue = (objectAssignExpression.expression as ts.CallExpression).arguments[1] as ts.ObjectLiteralExpression;
                                        if (customExtend) {
                                            const spread = ts.createSpreadAssignment(ts.createPropertyAccess(
                                                ts.createThis(),
                                                ts.createIdentifier('state')
                                            ));
                                            objectValue = ts.createObjectLiteral([spread, ...objectValue.properties]);
                                        }
                                        const directAssignExpression = ts.createExpressionStatement(
                                            ts.createBinary(
                                                ts.createPropertyAccess(
                                                    ts.createThis(),
                                                    // ts.createKeywordTypeNode(ts.SyntaxKind.ThisKeyword),
                                                    ts.createIdentifier('state')
                                                ),
                                                ts.SyntaxKind.EqualsToken,
                                                objectValue
                                            )
                                        );
                                        blockStatements = ts.createNodeArray(helpers.replaceItem(blockStatements, objectAssignExpression, directAssignExpression));
                                    }
                                    block = ts.updateBlock(block, blockStatements);
                                }
                                return ts.updateConstructor(member, member.decorators, member.modifiers, member.parameters, block);
                            }
                            return member;
                        });
                        return ts.updateClassDeclaration(statement, statement.decorators, statement.modifiers, statement.name, statement.typeParameters, statement.heritageClauses, members);
                    }
                    return statement;
                }));
                return ts.updateSourceFileNode(sourceFile, statements);
            }
        }
}

export default {
    recompile: false,
    factory: objectAssignStateFactoryFactory,
}

