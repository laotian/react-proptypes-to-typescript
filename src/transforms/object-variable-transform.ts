import * as ts from 'typescript';
import {VariableStatement} from 'typescript';

/**
 * const abc = {}; transform to: const abc: any = {};
 */
export function objectVariableTransformFactoryFactory(
    typeChecker: ts.TypeChecker,
): ts.TransformerFactory<ts.SourceFile> {
    return function objectVariableTransformFactory(context: ts.TransformationContext) {
        return function objectVariableTransform(sourceFile: ts.SourceFile) {
            ts.forEachChild(sourceFile,visitEach);
            return sourceFile;

            function visitEach(node: ts.Node) {
                if(ts.isVariableDeclaration(node)){
                    if(node.initializer && ts.isObjectLiteralExpression(node.initializer) && node.initializer.properties.length == 0 && !node.type){
                        node.type = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
                    }
                }
                ts.forEachChild(node,visitEach);
            }
        };
    };
}
