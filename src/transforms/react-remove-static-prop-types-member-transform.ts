import * as ts from 'typescript';

import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';

export type Factory = helpers.TransformFactoryAndRecompile;

/**
 * Remove static propTypes
 *
 * @example
 * Before:
 * class SomeComponent extends React.Component<{foo: number;}, {bar: string;}> {
 *   static propTypes = {
 *      foo: React.PropTypes.number.isRequired,
 *   }
 * }
 *
 * After:
 * class SomeComponent extends React.Component<{foo: number;}, {bar: string;}> {}
 */
function reactRemoveStaticPropTypesMemberTransformFactoryFactory(typeChecker: ts.TypeChecker, compilationOptions: CompilationOptions): Factory {
    return  function reactRemoveStaticPropTypesMemberTransformFactory(context: ts.TransformationContext) {
            return function reactRemoveStaticPropTypesMemberTransform(sourceFile: ts.SourceFile) {
                const visited = ts.visitEachChild(sourceFile, visitor, context);
                ts.addEmitHelpers(visited, context.readEmitHelpers());
                return visited;

                function visitor(node: ts.Node) {
                    if (ts.isClassDeclaration(node) && helpers.isReactComponent(node, typeChecker, compilationOptions)) {
                        return ts.updateClassDeclaration(
                            node,
                            node.decorators,
                            node.modifiers,
                            node.name,
                            node.typeParameters,
                            ts.createNodeArray(node.heritageClauses),
                            node.members.filter(member => {
                                if (
                                    ts.isPropertyDeclaration(member) &&
                                    helpers.hasStaticModifier(member) &&
                                    helpers.isPropTypesMember(member, sourceFile)
                                ) {
                                    return false;
                                }

                                // propTypes getter
                                if (
                                    ts.isGetAccessorDeclaration(member) &&
                                    helpers.hasStaticModifier(member) &&
                                    helpers.isPropTypesMember(member, sourceFile)
                                ) {
                                    return false;
                                }
                                return true;
                            }),
                        );
                    }
                    return node;
                }
            };
        }
}

export default {
    recompile: false,
    factory: reactRemoveStaticPropTypesMemberTransformFactoryFactory,
}
