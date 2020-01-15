import * as ts from 'typescript';
import {VariableStatement} from 'typescript';

/**
 * 插件内的方法定义, 从JSDoc类型改为TypeScript类型
 */
export function pluginTransformFactoryFactory(
    typeChecker: ts.TypeChecker,
): ts.TransformerFactory<ts.SourceFile> {
    return function pluginTransformFactory(context: ts.TransformationContext) {
        return function pluginTransform(sourceFile: ts.SourceFile) {
            const visited = ts.visitEachChild(sourceFile, visitor, context);
            ts.addEmitHelpers(visited, context.readEmitHelpers());

            return visited;

            function visitor(node: ts.Node) {
                if (ts.isVariableStatement(node)) {
                    return visitVariableStatement(node);
                }

                return node;
            }

            function visitVariableStatement(node:VariableStatement) {
                node.declarationList.declarations.forEach(vd=>{
                    if(ts.isIdentifier(vd.name) && vd.name.escapedText==='Plugin' && vd.initializer){
                        if(ts.isObjectLiteralExpression(vd.initializer)){
                            vd.initializer.properties.forEach((pluginMethod) =>{
                                if(ts.isMethodDeclaration(pluginMethod)){
                                    const returnType = ts.getJSDocReturnType(pluginMethod);
                                    pluginMethod.type = returnType;
                                    pluginMethod.parameters.forEach(parameter =>{
                                        const parameterType =  ts.getJSDocType(parameter);
                                        if(parameterType) {
                                            parameter.type = parameterType;
                                        }
                                    })
                                }
                            })
                        }
                    }

                });
                return node;
            }
        };
    };
}
