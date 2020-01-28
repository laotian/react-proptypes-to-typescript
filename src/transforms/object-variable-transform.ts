import * as ts from 'typescript';
import * as helpers from '../helpers';
import {VariableStatement} from 'typescript';
import { CompilationOptions } from '../compiler';

/**
 * const abc = {}; transform to: const abc: any = {};
 */
function objectVariableTransformFactoryFactory(
    typeChecker: ts.TypeChecker,
    compilationOptions: CompilationOptions
): helpers.TransformFactoryAndRecompile {
    return  function objectVariableTransformFactory(context: ts.TransformationContext) {
            return function objectVariableTransform(sourceFile: ts.SourceFile) {
                ts.forEachChild(sourceFile, visitEach);
                return sourceFile;

                function visitEach(node: ts.Node) {
                    if (ts.isVariableDeclaration(node)) {
                        if (node.initializer && !node.type) {
                            if (ts.isObjectLiteralExpression(node.initializer) && node.initializer.properties.length == 0) {
                                node.type = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
                            } else if (ts.isArrayLiteralExpression(node.initializer) && node.initializer.elements.length == 0) {
                                node.type = ts.createArrayTypeNode(ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
                            }
                        }
                    }
                    ts.forEachChild(node, visitEach);
                }
            };
        }
}

export default {
    recompile: false,
    factory: objectVariableTransformFactoryFactory
}
