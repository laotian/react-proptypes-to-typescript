import * as ts from 'typescript';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { TransformFactoryFactory } from '.';

export interface CompilationOptions {
    fixImportAbsolutePath: boolean,
    privatePropertyName: boolean,
    disableJsDoc: boolean,
}

const DEFAULT_COMPILATION_OPTIONS: CompilationOptions = {
    fixImportAbsolutePath: true,
    privatePropertyName: true,
    disableJsDoc: false,
};

export { DEFAULT_COMPILATION_OPTIONS };

/**
 * Compile and return result TypeScript
 * @param filePath Path to file to compile
 */
export function compile(
    filePath: string,
    factoryFactories: TransformFactoryFactory[],
    compilationOptions: CompilationOptions = DEFAULT_COMPILATION_OPTIONS,
) {


   let compileResult = "";
    // 合并需要重新编译的组
    const recompileGroup = new Array<Array<TransformFactoryFactory>>();
    let subGroup =new Array<TransformFactoryFactory>();
    factoryFactories.forEach((factory) =>{
         if(factory.recompile){
            subGroup.push(factory);
            recompileGroup.push(subGroup);
             subGroup = new Array<TransformFactoryFactory>();
         }else{
             subGroup.push(factory);
         }
    });

    if(subGroup.length>0){
        recompileGroup.push(subGroup);
    }

    recompileGroup.forEach(group =>{
        const compilerOptions: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2017,
            module: ts.ModuleKind.ES2015,
            jsx: ts.JsxEmit.Preserve,
            esModuleInterop: true,
        };
        const program = ts.createProgram([filePath], compilerOptions);
        // `program.getSourceFiles()` will include those imported files,
        // like: `import * as a from './file-a'`.
        // We should only transform current file.
        const sourceFiles = program.getSourceFiles().filter(sf => path.normalize(sf.fileName) === path.normalize(filePath));
        const typeChecker = program.getTypeChecker();


        const result = ts.transform(
            sourceFiles,
            group.map(ff => ff.factory(typeChecker, compilationOptions)),
            compilerOptions);

    // if (result.diagnostics && result.diagnostics.length) {
    //     console.log(
    //         chalk.yellow(`
    //     ======================= Diagnostics for ${filePath} =======================
    //     `),
    //     );
    //     for (const diag of result.diagnostics) {
    //         if (diag.file && diag.start) {
    //             const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
    //             console.log(`(${pos.line}, ${pos.character}) ${diag.messageText}`);
    //         }
    //     }
    // }

            const printer = ts.createPrinter();
            // TODO: fix the index 0 access... What if program have multiple source files?
            compileResult = printer.printNode(ts.EmitHint.SourceFile, result.transformed[0], sourceFiles[0]);
            fs.writeFileSync(filePath, compileResult, { encoding: 'utf8' });
    });

    return compileResult;
}