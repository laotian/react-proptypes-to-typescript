import * as ts from 'typescript';
import { statSync } from 'fs';
import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';

export type Factory = ts.TransformerFactory<ts.SourceFile>;

/**
 * declare class variables
 *
 * @example
 * Before:
 * import JDBMessageCenter from '/js/JDBRNKit/Utils/JDBMessageCenter';
 * After
 * import JDBMessageCenter from 'js/JDBRNKit/Utils/JDBMessageCenter';
 */
export function importAbsolutePathTransformFactoryFactory(typeChecker: ts.TypeChecker, compilationOptions: CompilationOptions): Factory {
    return function importAbsolutePathTransformFactory(context: ts.TransformationContext) {
        return function importAbsolutePathTransform(sourceFile: ts.SourceFile) {
            const visited = visitSourceFile(sourceFile, typeChecker);
            ts.addEmitHelpers(visited, context.readEmitHelpers());
            return visited;
        };
    };

    function visitSourceFile(sourceFile: ts.SourceFile, typeCheck: ts.TypeChecker) {
        let statements = sourceFile.statements;
        const importDeclarations = statements.filter(statement=>{
            return  ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text.startsWith("/js/");
        }).forEach(statement =>{
            const importDeclaration = statement as ts.ImportDeclaration;
            const relativePath = (importDeclaration.moduleSpecifier as ts.StringLiteral).text.substring(1);
            const newImportDeclaration = ts.updateImportDeclaration(importDeclaration,
                importDeclaration.decorators,
                importDeclaration.modifiers,
                importDeclaration.importClause,
                ts.createStringLiteral(relativePath));
            statements = ts.createNodeArray(helpers.replaceItem(statements, statement, newImportDeclaration));
        });

        return ts.updateSourceFileNode(sourceFile, statements);

    }

}

