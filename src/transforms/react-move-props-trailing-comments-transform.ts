import * as ts from 'typescript';
import * as _ from 'lodash';
import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';

export type Factory = helpers.TransformFactoryAndRecompile;

let compilationOptions: CompilationOptions;

/**
 * To keep PropsTypes member trailing comment, change the comment format
 * before:
 * static propTypes = {
 *      fetchData: PropTypes.func.isRequired, // 网络请求函数
 *  }
 *
 *  After:
 * static propTypes = {
 *      fetchData: PropTypes.func.isRequired // 网络请求函数
 *      ,
 *  }
 *
 *  then copy the leading/trailing comments to the  props interface definition by the react-js-make-props-and-state-transform
 */
function reactJMovePropsTrailingCommentsTransformFactoryFactory(typeChecker: ts.TypeChecker, _compilationOptions: CompilationOptions): Factory {
    compilationOptions = _compilationOptions;
    return function reactJMovePropsTrailongCommentsTransformFactory(context: ts.TransformationContext) {
        return function reactJMovePropsTrailongCommentsTransform(sourceFile: ts.SourceFile) {
            const visited = visitSourceFile(sourceFile, typeChecker, compilationOptions);
            ts.addEmitHelpers(visited, context.readEmitHelpers());

            return visited;
        }
    }
}

function visitSourceFile(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker, compilationOptions: CompilationOptions) {
    for (const statement of sourceFile.statements) {
        if (ts.isClassDeclaration(statement) && helpers.isReactComponent(statement, typeChecker)) {
            moveTrailingComments(statement, sourceFile);
        }
    }
    return sourceFile;
}

function moveTrailingComments(
    classDeclaration: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
) {
    const staticPropTypesMember = _.find(classDeclaration.members, member => {
        return (
            ts.isPropertyDeclaration(member) &&
            helpers.hasStaticModifier(member) &&
            helpers.isPropTypesMember(member, sourceFile)
        );
    });
    if (
        staticPropTypesMember !== undefined &&
        ts.isPropertyDeclaration(staticPropTypesMember) && // check to satisfy type checker
        staticPropTypesMember.initializer &&
        ts.isObjectLiteralExpression(staticPropTypesMember.initializer)
    ) {
        const propTypesObject= staticPropTypesMember.initializer;
        helpers.filterEachNode<ts.PropertyAssignment>(propTypesObject, ts.isPropertyAssignment)
            .forEach(propertyAssignment=>{

                helpers.copyTrailingComment(propertyAssignment,propertyAssignment, 1, true);
                // const sourceText = propertyAssignment.getSourceFile().text;




                // ts.addSyntheticTrailingComment(propertyAssignment, ts.SyntaxKind.SingleLineCommentTrivia, "HEHE", true);
               // helpers.copyTrailingComment(propertyAssignment,propertyAssignment, true);
            });
        return;
    }

    const staticPropTypesGetterMember = _.find(classDeclaration.members, member => {
        return (
            ts.isGetAccessorDeclaration(member) &&
            helpers.hasStaticModifier(member) &&
            helpers.isPropTypesMember(member, sourceFile)
        );
    });

    if (
        staticPropTypesGetterMember !== undefined &&
        ts.isGetAccessorDeclaration(staticPropTypesGetterMember) // check to satisfy typechecker
    ) {
        const returnStatement = _.find(staticPropTypesGetterMember.body!.statements, statement =>
            ts.isReturnStatement(statement),
        );
        if (
            returnStatement !== undefined &&
            ts.isReturnStatement(returnStatement) && // check to satisfy typechecker
            returnStatement.expression &&
            ts.isObjectLiteralExpression(returnStatement.expression)
        ) {
            helpers.filterEachNode<ts.PropertyAssignment>(returnStatement.expression, ts.isPropertyAssignment)
                .forEach(propertyAssignment=>{
                    helpers.copyTrailingComment(propertyAssignment,propertyAssignment, 1,true);
                });
        }
    }
}

export default {
    recompile: false,
    factory: reactJMovePropsTrailingCommentsTransformFactoryFactory,
}
