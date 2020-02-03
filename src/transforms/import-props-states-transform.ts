import * as ts from 'typescript';
import { statSync } from 'fs';
import * as helpers from '../helpers';
import { CompilationOptions } from '../compiler';
import { setTokenSourceMapRange } from 'typescript';

export type Factory = helpers.TransformFactoryAndRecompile;

const CLASS_NAMES = {
    props:{
        name:'Props',
        alias:'BaseProps'
    },
    states:{
        name:'States',
        alias:'BaseStates'
    }
}

/**
 * declare class variables
 *
 * @example
 * Before:
 * import JDBMessageCenter from '/js/JDBRNKit/Utils/JDBMessageCenter';
 * After
 * import JDBMessageCenter from 'js/JDBRNKit/Utils/JDBMessageCenter';
 */
function importPropsStatesTransformFactoryFactory(typeChecker: ts.TypeChecker, compilationOptions: CompilationOptions): Factory {
    return function importPropsStatesTransformFactory(context: ts.TransformationContext) {
            return function importPropsStatesTransform(sourceFile: ts.SourceFile) {
                const visited = visitSourceFile(sourceFile, typeChecker);
                ts.addEmitHelpers(visited, context.readEmitHelpers());
                return visited;
            };
        }

    function visitSourceFile(sourceFile: ts.SourceFile, typeCheck: ts.TypeChecker) {
        let statements = sourceFile.statements;
        let superComponentName : string | undefined = undefined;
        let classDeclaration: ts.Statement |  undefined = undefined;
        // let componentName: string | undefined = undefined;
        let customExtend = false;
        statements.forEach(statement=>{
            if(ts.isClassDeclaration(statement) || ts.isClassExpression(statement)) {
                const superComponentName = helpers.getReactComponentSuperClassName(statement, typeChecker);
                if(superComponentName){
                    classDeclaration = statement;
                    customExtend = helpers.isReactComponentGrandson(statement, typeChecker) || false;
                    if(statement.name && ts.isIdentifier(statement.name)){
                       const  componentName = statement.name.text;
                        if(customExtend) {
                            statements.filter(statement => {
                                if (ts.isImportDeclaration(statement) && statement.importClause) {
                                    // import XXX
                                    if(statement.importClause.name && ts.isIdentifier(statement.importClause.name) && statement.importClause.name.text == superComponentName) {
                                        return true;
                                    }
                                    //import {XXX}
                                    if(statement.importClause.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)){
                                        return  statement.importClause.namedBindings.elements.find(element=>{
                                            return  ts.isIdentifier(element.name) && element.name.text===superComponentName;
                                        })
                                    }
                                }
                                return false;
                            }).forEach(statement => {
                                const importDeclaration = statement as ts.ImportDeclaration;
                                if (importDeclaration.importClause) {
                                    let importFromBase = [
                                        ts.createImportSpecifier(ts.createIdentifier(CLASS_NAMES.props.name), ts.createIdentifier(CLASS_NAMES.props.alias)),
                                        ts.createImportSpecifier(ts.createIdentifier(CLASS_NAMES.states.name), ts.createIdentifier(CLASS_NAMES.states.alias))
                                    ];

                                    const importSpecifierList = new Array<ts.ImportSpecifier>();
                                    if (importDeclaration.importClause.namedBindings && ts.isNamedImports(importDeclaration.importClause.namedBindings)) {
                                        importDeclaration.importClause.namedBindings.elements.forEach(value => {
                                            importSpecifierList.push(value);
                                        })
                                    }

                                    for(const importSpecifier of importFromBase) {
                                        if(!importSpecifierList.some(specifier=>importSpecifier.name.text === specifier.name.text)){
                                            importSpecifierList.push(importSpecifier);
                                        }
                                    }

                                    const importClause = ts.updateImportClause(
                                        importDeclaration.importClause,
                                        importDeclaration.importClause.name,
                                        ts.createNamedImports(importSpecifierList)
                                    );
                                    const newImportDeclaration = ts.updateImportDeclaration(importDeclaration,
                                        importDeclaration.decorators,
                                        importDeclaration.modifiers,
                                        importClause,
                                        importDeclaration.moduleSpecifier);

                                    statements = ts.createNodeArray(helpers.replaceItem(statements, statement, newImportDeclaration));
                                }
                            });
                        }

                        let propsInterfaceDeclaration = ts.createInterfaceDeclaration(
                            [],
                            [],
                            `${componentName}${CLASS_NAMES.props.name}`,
                            [],
                            customExtend ? [createHeritageClause(CLASS_NAMES.props.alias)] : undefined,
                            [],
                        );
                        let statesInterfaceDeclaration = ts.createInterfaceDeclaration(
                            [],
                            [],
                            `${componentName}${CLASS_NAMES.states.name}`,
                            [],
                            customExtend ? [createHeritageClause(CLASS_NAMES.states.alias)] : undefined,
                            [],
                        );
                        const interfaceDeclarations: ts.InterfaceDeclaration[] = [propsInterfaceDeclaration, statesInterfaceDeclaration];
                        const addedTypeDeclarations: ts.Statement[] = [];
                        for(const interfaceDeclaration of interfaceDeclarations) {
                            if (!statements.find(statement => ts.isInterfaceDeclaration(statement) && statement.name.text == interfaceDeclaration.name.text)){
                                addedTypeDeclarations.push(interfaceDeclaration);
                            }
                        }
                        statements = ts.createNodeArray(helpers.insertBefore(statements, classDeclaration!, addedTypeDeclarations));
                    }
                }
            }
        });
        return ts.updateSourceFileNode(sourceFile, statements);
    }


    function createHeritageClause(extendFrom:string) {
        const expression = ts.createIdentifier(extendFrom);
        const expressionWithTypeArguments = ts.createExpressionWithTypeArguments(undefined, expression);
        return ts.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [expressionWithTypeArguments]);
    }
}

export default {
    recompile: true,
    factory: importPropsStatesTransformFactoryFactory,
}

