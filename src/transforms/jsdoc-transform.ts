import * as ts from 'typescript';
import {VariableStatement} from 'typescript';

/**
 * 处理方法定义中的JSDOC 为 typescript 类型定义，包括参数与返回值
 */
export function jsDocTransformFactoryFactory(
    typeChecker: ts.TypeChecker,
): ts.TransformerFactory<ts.SourceFile> {
    return function jsDocTransformFactory(context: ts.TransformationContext) {
        return function jsDocTransform(sourceFile: ts.SourceFile) {
            ts.forEachChild(sourceFile,visitEach);
            return sourceFile;

            function visitEach(node: ts.Node) {
                if(ts.isMethodDeclaration(node)){
                    const returnType = ts.getJSDocReturnType(node);
                    if(!node.type && returnType) {
                        node.type = returnType;
                    }
                    node.parameters.forEach(parameter =>{
                        const parameterType =  ts.getJSDocType(parameter);
                        if(!parameter.type && parameterType) {
                            parameter.type = parameterType;
                        }
                    })
                    return;
                }
                ts.forEachChild(node,visitEach);
            }
        };
    };
}
