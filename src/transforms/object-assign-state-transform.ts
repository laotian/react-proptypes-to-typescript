import * as ts from 'typescript';
import { statSync } from 'fs';
import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';
import { CallExpression } from 'typescript';

export type Factory = ts.TransformerFactory<ts.SourceFile>;

/**
 * declare class variables
 *
 * @example
 * Before:
 *     onResponseDataSucceed(dataModel) {}
 * After
 *    onResponseDataSucceed(dataModel: JDBBaseModel) {}
 */
export function objectAssignStateFactoryFactory(typeChecker: ts.TypeChecker, compilationOptions: CompilationOptions): Factory {
    return function objectAssignStateFactory(context: ts.TransformationContext) {
        return function objectAssignStateTransform(sourceFile: ts.SourceFile) {
            const visited = visitSourceFile(sourceFile, typeChecker);
            ts.addEmitHelpers(visited, context.readEmitHelpers());
            return visited;
        };
    };

    let foundResponse = false;
    function visitSourceFile(sourceFile: ts.SourceFile, typeCheck: ts.TypeChecker) {
        let statements = sourceFile.statements;
        statements = ts.createNodeArray(statements.map(statement => {
            if(ts.isClassDeclaration(statement) && helpers.isReactComponent(statement,typeChecker,compilationOptions)){
                const extendFrom = helpers.getComponentExtend(statement, typeChecker)!;
                const customExtend = !["React.Component","Component"].includes(extendFrom);
                const members = statement.members.map(member=>{
                    if(ts.isConstructorDeclaration(member)){
                        let block = member.body;
                        if(block){
                            let blockStatements = block.statements;
                            const objectAssignState =  helpers.filter(blockStatements, helpers.isObjectAssignState);
                            if(objectAssignState && objectAssignState.length ==1){
                                  const objectAssignExpression =   objectAssignState[0] as ts.ExpressionStatement;
                                  let objectValue = (objectAssignExpression.expression as ts.CallExpression).arguments[1] as ts.ObjectLiteralExpression;
                                  if(customExtend) {
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

                              blockStatements =  ts.createNodeArray(helpers.replaceItem(blockStatements, objectAssignExpression, directAssignExpression));


                            }
                            block = ts.updateBlock(block, blockStatements);
                        }
                        return ts.updateConstructor(member,member.decorators,member.modifiers,member.parameters,block);
                    }
                    return member;
                });
                return ts.updateClassDeclaration(statement,statement.decorators,statement.modifiers,statement.name,statement.typeParameters,statement.heritageClauses, members);
            }
            return statement;
        }));
        // const found =   statements.filter(statement=>{
        //     return  ts.isImportDeclaration(statement) && statement.importClause && statement.importClause.name && ts.isIdentifier(statement.importClause.name) && statement.importClause.name.text===DATA_MODEL ;
        // }).length>0;
        //
        // let lastImport : ts.Statement | undefined = undefined;
        // let classDefine: ts.Statement | undefined = undefined;
        // statements.forEach(statement =>{
        //     if(ts.isImportDeclaration(statement)){
        //         lastImport = statement;
        //     }
        //     if(ts.isClassDeclaration(statement) && !classDefine){
        //         classDefine = statement;
        //     }
        // });
        //
        // if(!found && foundResponse && sourceFile.fileName.indexOf("js/RDF/")<0) {
        //     const newImportDeclaration = ts.createImportDeclaration(undefined,undefined,ts.createImportClause(ts.createIdentifier(DATA_MODEL), undefined), ts.createStringLiteral(DATA_MODEL_PATH));
        //     if(lastImport){
        //         statements = ts.createNodeArray(helpers.insertAfter(statements, lastImport, newImportDeclaration));
        //     }else if(classDefine) {
        //         statements = ts.createNodeArray(helpers.insertBefore(statements, classDefine, newImportDeclaration));
        //     }
        // }
        return ts.updateSourceFileNode(sourceFile, statements);
    }

}

