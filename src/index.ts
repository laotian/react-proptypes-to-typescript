import * as ts from 'typescript';
import { compile, CompilationOptions, DEFAULT_COMPILATION_OPTIONS } from './compiler';
import { reactJSMakePropsAndStateInterfaceTransformFactoryFactory } from './transforms/react-js-make-props-and-state-transform';
import { reactRemovePropTypesAssignmentTransformFactoryFactory } from './transforms/react-remove-prop-types-assignment-transform';
import { reactMovePropTypesToClassTransformFactoryFactory } from './transforms/react-move-prop-types-to-class-transform';
import { collapseIntersectionInterfacesTransformFactoryFactory } from './transforms/collapse-intersection-interfaces-transform';
import { reactRemoveStaticPropTypesMemberTransformFactoryFactory } from './transforms/react-remove-static-prop-types-member-transform';
import { reactStatelessFunctionMakePropsTransformFactoryFactory } from './transforms/react-stateless-function-make-props-transform';
import { reactRemovePropTypesImportTransformFactoryFactory } from './transforms/react-remove-prop-types-import';
import { classInstanceVariablesTransformFactoryFactory } from './transforms/class-instance-variables-transform';
import {jsDocTransformFactoryFactory} from './transforms/jsdoc-transform';
import {importAbsolutePathTransformFactoryFactory} from './transforms/import-absolute-path-transform';
import {objectVariableTransformFactoryFactory} from './transforms/object-variable-transform';
import {onResponseTransformFactoryFactory} from './transforms/on-response-transform';
import {objectAssignStateFactoryFactory} from './transforms/object-assign-state-transform';

export {
    reactMovePropTypesToClassTransformFactoryFactory,
    reactJSMakePropsAndStateInterfaceTransformFactoryFactory,
    reactStatelessFunctionMakePropsTransformFactoryFactory,
    collapseIntersectionInterfacesTransformFactoryFactory,
    reactRemovePropTypesAssignmentTransformFactoryFactory,
    reactRemoveStaticPropTypesMemberTransformFactoryFactory,
    reactRemovePropTypesImportTransformFactoryFactory,
    classInstanceVariablesTransformFactoryFactory,
    compile,
};

export const allTransforms = [
    reactMovePropTypesToClassTransformFactoryFactory,

    reactJSMakePropsAndStateInterfaceTransformFactoryFactory,
    reactStatelessFunctionMakePropsTransformFactoryFactory,
    collapseIntersectionInterfacesTransformFactoryFactory,
    reactRemovePropTypesAssignmentTransformFactoryFactory,
    reactRemoveStaticPropTypesMemberTransformFactoryFactory,
    reactRemovePropTypesImportTransformFactoryFactory,
    classInstanceVariablesTransformFactoryFactory,
    jsDocTransformFactoryFactory,
    importAbsolutePathTransformFactoryFactory,
    objectVariableTransformFactoryFactory,
    onResponseTransformFactoryFactory,
    objectAssignStateFactoryFactory,
];

export type TransformFactoryFactory = (typeChecker: ts.TypeChecker, compilationOptions: CompilationOptions) => ts.TransformerFactory<ts.SourceFile>;

/**
 * Run React JavaScript to TypeScript transform for file at `filePath`
 * @param filePath
 */
export function run(
    filePath: string,
    compilationOptions: CompilationOptions = DEFAULT_COMPILATION_OPTIONS
): string {
    return compile(filePath, allTransforms, compilationOptions);
}
