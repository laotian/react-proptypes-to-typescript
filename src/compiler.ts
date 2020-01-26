import * as ts from 'typescript';
import chalk from 'chalk';
import * as path from 'path';

import { TransformFactoryFactory } from '.';
import { strict } from 'assert';

export interface CompilationOptions {
    react?: {
        reactClassValidator: (superClassName: string | undefined) => boolean;
    }
    classProperty?: {
        propertyNameValidator: (superClassName:string, propertyName:string) =>boolean;
        customReferenceType: (superClassName: string, express:string) => string | undefined;
    }
}

const DEFAULT_COMPILATION_OPTIONS: CompilationOptions = {
    react: {
        reactClassValidator: function(superClassName) {
             if(superClassName) {
                 return /\w+BaseComponent|\w+BaseContainer|\w+BaseListContainer/.test(superClassName);
             }
             return false;
        }
    },
    classProperty: {
        propertyNameValidator: function(superClassName, propertyName) {
            return true;
        },
        customReferenceType: function(superClassName, express) {
            return undefined;
        }
    }
};

export { DEFAULT_COMPILATION_OPTIONS };

function collectProperties(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker): Array<string> {
    let array = new Array<string>();
    sourceFile.statements.forEach(statement=>{
    if(ts.isClassDeclaration(statement)){
        if(statement.heritageClauses){
            statement.heritageClauses.forEach(heritageClause=>{
                heritageClause.types.forEach(type=>{

                    console.log("======begin=====");
                   typeChecker.getTypeAtLocation(statement).getProperties().forEach(value=>{
                       console.log(value.escapedName);
                   });
                    console.log("======end=====");

                    console.log(typeChecker.getTypeAtLocation(type).getConstraint());
                    // if(baseTypes){
                    //     console.log("found baseType:"+baseTypes);
                    //     baseTypes.forEach(baseType=>{
                    //         baseType.getProperties().forEach(p=>{
                    //             console.log(":::"+p.escapedName);
                    //         })
                    //     })
                    // }
                    // console.log("parent:::"+type.getText()+",sourceFile:"+type.getSourceFile().fileName+",typeChecker.getTypeAtLocation():"+typeChecker.typeToString(typeChecker.getTypeAtLocation(type)));
                })
            })
        }
    }
});
    return array;
}


/**
 * Compile and return result TypeScript
 * @param filePath Path to file to compile
 */
export function compile(
    filePath: string,
    factoryFactories: TransformFactoryFactory[],
    compilationOptions: CompilationOptions = DEFAULT_COMPILATION_OPTIONS,
) {
    const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2017,
        module: ts.ModuleKind.ES2015,
    };

    const program = ts.createProgram([filePath], compilerOptions);


    // `program.getSourceFiles()` will include those imported files,
    // like: `import * as a from './file-a'`.
    // We should only transform current file.
    const sourceFiles = program.getSourceFiles().filter(sf => path.normalize(sf.fileName) === path.normalize(filePath));
    const typeChecker = program.getTypeChecker();


    // program.getSourceFiles().forEach(sourceFile=>{
    //     if(!sourceFile.isDeclarationFile){
    //         console.log(">>"+sourceFile.fileName);
    //     }
    // });
    collectProperties(sourceFiles[0],typeChecker);
    const result = ts.transform(
        sourceFiles,
        factoryFactories.map(factoryFactory => factoryFactory(typeChecker, compilationOptions), compilerOptions),
    );

    if (result.diagnostics && result.diagnostics.length) {
        console.log(
            chalk.yellow(`
        ======================= Diagnostics for ${filePath} =======================
        `),
        );
        for (const diag of result.diagnostics) {
            if (diag.file && diag.start) {
                const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
                console.log(`(${pos.line}, ${pos.character}) ${diag.messageText}`);
            }
        }
    }

    const printer = ts.createPrinter();

    // TODO: fix the index 0 access... What if program have multiple source files?
    const printed = printer.printNode(ts.EmitHint.SourceFile, result.transformed[0], sourceFiles[0]);
    return printed;
}