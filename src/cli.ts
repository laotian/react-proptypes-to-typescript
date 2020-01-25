#!/usr/bin/env node
import * as program from 'commander';
import * as glob from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { run } from '.';
import { CompilationOptions, DEFAULT_COMPILATION_OPTIONS } from './compiler';
import check from './check';
import { execSync } from 'child_process';

function resolveGlobs(globPatterns: string[]): string[] {
    const files: string[] = [];
    function addFile(file: string) {
        file = path.resolve(file);
        if (files.indexOf(file) === -1) {
            files.push(file);
        }
    }
    globPatterns.forEach(pattern => {
        if (/[{}*?+\[\]]/.test(pattern)) {
            // Smells like globs
            glob.sync(pattern, {
                absolute: true,
            }).forEach(file => {
                addFile(file);
            });
        } else {
            addFile(pattern);
        }
    });
    return files;
}

program
    .version('1.0.0')
    .option('--remove-original-files', 'remove original files', false)
    .option('--keep-temporary-files', 'Keep temporary files', false)
    .option('--print', 'print output to console', false)
    .option('--check', 'check @ts-ignore error and module.exports error', false)
    .option('--rename','rename .js file extension name to .ts or .tsx',false)
    .option('--compile-config <string>','set compiler config file','')
    .usage('[options] <filename or glob>')
    .command('* [glob/filename...]')
    .action((globPatterns: string[]) => {

        let compilationOptions: CompilationOptions = DEFAULT_COMPILATION_OPTIONS;
        const configFile = program.compileConfig ? path.resolve(program.compileConfig) : "";
        if(configFile && fs.existsSync(configFile)){
            compilationOptions = require(configFile);
            if(!compilationOptions.react){
                compilationOptions.react = DEFAULT_COMPILATION_OPTIONS.react;
            }
            if(!compilationOptions.classProperty){
                compilationOptions.classProperty = DEFAULT_COMPILATION_OPTIONS.classProperty;
            }
            if(!compilationOptions.react!.reactClassValidator){
                compilationOptions.react!.reactClassValidator = DEFAULT_COMPILATION_OPTIONS.react!.reactClassValidator;
            }
            if(!compilationOptions.classProperty!.propertyNameValidator){
                compilationOptions.classProperty!.propertyNameValidator = DEFAULT_COMPILATION_OPTIONS.classProperty!.propertyNameValidator;
            }
            if(!compilationOptions.classProperty!.customReferenceType){
                compilationOptions.classProperty!.customReferenceType = DEFAULT_COMPILATION_OPTIONS.classProperty!.customReferenceType;
            }
        }

        const files = resolveGlobs(globPatterns);
        if (!files.length) {
            throw new Error('Nothing to do. You must provide file names or glob patterns to transform.');
        }
        let errors = false;

        if (program.check) {
            for (const filePath of files) {
                if (!fs.existsSync(filePath)) {
                    continue;
                }
                let errorMessage = check(filePath);
                if (errorMessage) {
                    console.error(`error: ${errorMessage}, file: ${filePath}`);
                    errors = true;
                }
            }
        } else if(program.rename){
            for (const filePath of files) {
                if (!fs.existsSync(filePath)) {
                    continue;
                }
                const extension = getExtension(filePath);
                const newPath = filePath.replace(/\.jsx?$/, extension);
                if(!fs.existsSync(newPath)) {
                    execSync(`git mv ${path.basename(filePath)} ${path.basename(newPath)}`,{
                        cwd: path.dirname(newPath),
                        encoding: 'utf8'
                    });
                }
            }
            console.log("git rename finished, please commit to git repository")
        } else {
            for (const filePath of files) {
                if (!fs.existsSync(filePath)) {
                    continue;
                }
                console.log(`Transforming ${filePath}...`);
                const extension = getExtension(filePath);
                const newPath = filePath.replace(/\.jsx?$/, extension);
                const temporaryPath = filePath + `_js2ts_${+new Date()}${extension}`;
                try {
                    fs.copyFileSync(filePath, temporaryPath);
                    const result = run(temporaryPath, compilationOptions);
                    if (program.print) {
                        console.log('result:\n', result);
                    }
                    if (program.removeOriginalFiles) {
                        fs.unlinkSync(filePath);
                    }
                    fs.writeFileSync(newPath, result);
                } catch (error) {
                    console.warn(`Failed to convert ${filePath}`);
                    console.warn(error);
                    errors = true;
                }
                if (!program.keepTemporaryFiles) {
                    if (fs.existsSync(temporaryPath)) {
                        fs.unlinkSync(temporaryPath);
                    }
                }
            }
        }
        if (errors) {
            process.exit(1);
        }
    });

program.parse(process.argv);

function getExtension(filePath: string): string {
    const text = fs.readFileSync(filePath, 'utf8');
    if (text.match(/<\w+/) && (text.match(/<\//) || text.match(/\/>/))) {
        return '.tsx';
    } else {
        return '.ts';
    }
}
