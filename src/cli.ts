#!/usr/bin/env node
import * as program from 'commander';
import * as glob from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import * as prettier from 'prettier';

import { run } from '.';
import { CompilationOptions } from './compiler';
import check from './check';

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
    .option('--arrow-parens <avoid|always>', 'Include parentheses around a sole arrow function parameter.', 'avoid')
    .option('--no-bracket-spacing', 'Do not print spaces between brackets.', false)
    .option('--jsx-bracket-same-line', 'Put > on the last line instead of at a new line.', false)
    .option('--print-width <int>', 'The line length where Prettier will try wrap.', 80)
    .option('--prose-wrap <always|never|preserve> How to wrap prose. (markdown)', 'preserve')
    .option('--no-semi', 'Do not print semicolons, except at the beginning of lines which may need them', false)
    .option('--single-quote', 'Use single quotes instead of double quotes.', false)
    .option('--tab-width <int>', 'Number of spaces per indentation level.', 2)
    .option('--trailing-comma <none|es5|all>', 'Print trailing commas wherever possible when multi-line.', 'none')
    .option('--use-tabs', 'Indent with tabs instead of spaces.', false)
    .option('--ignore-prettier-errors', 'Ignore (but warn about) errors in Prettier', false)
    .option('--remove-original-files', 'remove original files', false)
    .option('--keep-temporary-files', 'Keep temporary files', false)
    .option('--print', 'print output to console', false)
    .option('--check', '检查手动修是否存在问题', false)
    .usage('[options] <filename or glob>')
    .command('* [glob/filename...]')
    .action((globPatterns: string[]) => {
        const prettierOptions: prettier.Options = {
            arrowParens: program.arrowParens,
            bracketSpacing: !program.noBracketSpacing,
            jsxBracketSameLine: !!program.jsxBracketSameLine,
            printWidth: parseInt(program.printWidth, 10),
            proseWrap: program.proseWrap,
            semi: !program.noSemi,
            singleQuote: !!program.singleQuote,
            tabWidth: parseInt(program.tabWidth, 10),
            trailingComma: program.trailingComma,
            useTabs: !!program.useTabs,
        };
        const compilationOptions: CompilationOptions = {
            ignorePrettierErrors: !!program.ignorePrettierErrors,
        };
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
                let errorCount = check(filePath);
                if (errorCount) {
                    console.warn(`发现 ${errorCount}处 @ts-ignore 错误: ${filePath}`);
                    errors = true;
                }
            }
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
                    const result = run(temporaryPath, prettierOptions, compilationOptions);
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
