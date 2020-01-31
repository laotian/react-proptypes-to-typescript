import * as ts from 'typescript';
import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';

// todo 支持配置黑名单类型或传入检验function
const blackListTypes = ["XML","xml","*"];

function isValidType(typeNode?: ts.TypeNode) {
    if(typeNode && !blackListTypes.includes(typeNode.getText())){
        return true;
    }
    return false;
}

/**
 * 处理方法定义中的JSDOC 为 typescript 类型定义，包括参数与返回值
 */
function jsDocTransformFactoryFactory(
    typeChecker: ts.TypeChecker,
    compilationOptions: CompilationOptions
): helpers.TransformFactoryAndRecompile {
    return  function jsDocTransformFactory(context: ts.TransformationContext) {
            return function jsDocTransform(sourceFile: ts.SourceFile) {
                ts.forEachChild(sourceFile, visitEach);
                return sourceFile;

                function visitEach(node: ts.Node) {
                    if (ts.isMethodDeclaration(node)) {
                        const returnType = ts.getJSDocReturnType(node);
                        if (!node.type && isValidType(returnType)) {
                            node.type = returnType;
                        }
                        node.parameters.forEach(parameter => {
                            const parameterType = ts.getJSDocType(parameter);
                            if (!parameter.type && isValidType(parameterType)) {
                                parameter.type = parameterType;
                            }
                        })
                        return;
                    }
                    ts.forEachChild(node, visitEach);
                }
            };
        }
}

export default {
    recompile: false,
    factory: jsDocTransformFactoryFactory,
}