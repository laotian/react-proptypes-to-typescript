import * as ts from 'typescript';
import { statSync } from 'fs';
import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';

export type Factory = ts.TransformerFactory<ts.SourceFile>;

const DATA_MODEL = "JDBBaseModel";
const DATA_MODEL_PATH = "js/JDBRNKit/Base/JDBBaseModel";
const onResponseDataSucceed = "onResponseDataSucceed";
const onResponseDataFail = "onResponseDataFail";

/**
 * declare class variables
 *
 * @example
 * Before:
 *     onResponseDataSucceed(dataModel) {}
 * After
 *    onResponseDataSucceed(dataModel: JDBBaseModel) {}
 */
export function onResponseTransformFactoryFactory(typeChecker: ts.TypeChecker, compilationOptions: CompilationOptions): Factory {
    return function onResponseTransformFactory(context: ts.TransformationContext) {
        return function onResponseTransform(sourceFile: ts.SourceFile) {
            const visited = visitSourceFile(sourceFile, typeChecker);
            ts.addEmitHelpers(visited, context.readEmitHelpers());
            return visited;
        };
    };

    let foundResponse = false;
    function visitSourceFile(sourceFile: ts.SourceFile, typeCheck: ts.TypeChecker) {

        function visitEach(node: ts.Node){
            if(ts.isMethodDeclaration(node)){
                if(ts.isIdentifier(node.name) && [onResponseDataSucceed,onResponseDataFail].includes(node.name.text)){
                    foundResponse = true;
                    if(node.parameters.length>=1){
                        if(!node.parameters[0].type){
                            node.parameters[0].type  = ts.createTypeReferenceNode(DATA_MODEL, undefined);
                        }
                    }
                }
                return;
            }
            node.forEachChild(visitEach);
        }
        sourceFile.forEachChild(visitEach);

        let statements = sourceFile.statements;
        const found =   statements.filter(statement=>{
            return  ts.isImportDeclaration(statement) && statement.importClause && statement.importClause.name && ts.isIdentifier(statement.importClause.name) && statement.importClause.name.text===DATA_MODEL ;
        }).length>0;

        let lastImport : ts.Statement | undefined = undefined;
        let classDefine: ts.Statement | undefined = undefined;
        statements.forEach(statement =>{
            if(ts.isImportDeclaration(statement)){
                lastImport = statement;
            }
            if(ts.isClassDeclaration(statement) && !classDefine){
                classDefine = statement;
            }
        });

        if(!found && foundResponse) {
            const newImportDeclaration = ts.createImportDeclaration(undefined,undefined,ts.createImportClause(ts.createIdentifier(DATA_MODEL), undefined), ts.createStringLiteral(DATA_MODEL_PATH));
            if(lastImport){
                statements = ts.createNodeArray(helpers.insertAfter(statements, lastImport, newImportDeclaration));
            }else if(classDefine) {
                statements = ts.createNodeArray(helpers.insertBefore(statements, classDefine, newImportDeclaration));
            }
        }
        return ts.updateSourceFileNode(sourceFile, statements);
    }

}

