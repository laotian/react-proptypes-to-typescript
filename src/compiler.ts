import * as ts from 'typescript';
import chalk from 'chalk';
import * as path from 'path';

import { TransformFactoryFactory } from '.';

export interface CompilationOptions {
    react?: {
        reactClassValidator: (superClassName: string | undefined) => boolean;
    }
    classProperty?: {
        propertyNameValidator: (className:string, propertyName:string) =>boolean;
        customReferenceType: (className: string, express:string) => string | undefined;
    }
}

const referenceTypes =  ["this\\.produceModel\\((\\w+)\\)",   "this\\.produceUIModel\\((\\w+)\\)"];
const blackListProperties = ["listViewType","needsPullDownToRefresh","needsPullUpToLoadMore","refreshingType","_renderFooterView","_listView","pageSize","emotionViewState","ipViewState","UIModel", "navigationBar","isListView"];
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
        propertyNameValidator: function(className, propertyName) {
            return !blackListProperties.includes(propertyName);
        },
        customReferenceType: function(className, express) {
            for( let rt of referenceTypes) {
                let  match = express.match(new RegExp(rt));
                if (match) {
                    return  match[1];
                }
            }
            return undefined;
        }
    }
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