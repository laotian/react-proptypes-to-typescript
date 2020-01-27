import * as ts from 'typescript';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
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

    // const typeNode =  ts.createTypeReferenceNode('RDFBaseListContainer',undefined);
    //
    // typeChecker.getTypeAtLocation(typeNode).getProperties().forEach(property=>{
    //     console.log(property.name+">>");
    // });


    let array = new Array<string>();
    sourceFile.statements.forEach(statement=>{
    if(ts.isClassDeclaration(statement)){
        console.log("======begin=====");
        // statement.members.forEach(memeber=)
        if(statement.heritageClauses){
            const value1 = statement.heritageClauses[0].types[0];
            // console.log(statement.heritageClauses[0]);
            console.log("value1::"+value1.getText()) ;
            typeChecker.getTypeAtLocation(value1).getProperties().forEach(value=>{
                console.log(value.escapedName);
            });
        }

        // typeChecker.getTypeAtLocation(statement).getProperties().forEach(value=>{
        //     console.log(value.escapedName);
        // });
        console.log("======end=====");
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
        jsx: ts.JsxEmit.Preserve,
    };

    const program = ts.createProgram([filePath], compilerOptions);


    // `program.getSourceFiles()` will include those imported files,
    // like: `import * as a from './file-a'`.
    // We should only transform current file.


    // program.getSourceFiles().forEach(value=>{
    //     // if(!value.isDeclarationFile) {
    //     if(value.fileName.indexOf(".d.ts")<0){
    //         console.log(value.fileName);
    //     }
    // });

 fs.writeFileSync("d:/modules.txt",   program.getSourceFiles().map(value=>{
        if(value.fileName.indexOf(".d.ts")<0) {
            return value.fileName;
        }
        return ""
    }).join("\n"));

    const sourceFiles = program.getSourceFiles().filter(sf => path.normalize(sf.fileName) === path.normalize(filePath));
    const typeChecker = program.getTypeChecker();


    // typeChecker.getAugmentedPropertiesOfType()

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