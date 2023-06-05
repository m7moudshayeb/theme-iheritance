/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const glob = require("glob");

/**
* @params blueprintNames: string[] holds the directory names of child themes/websites
* @params baseBluePrint: string holds the dicretory name of the parent theme
*/
class CopyBaseThemePlugin {
    constructor(blueprintNames, baseBluePrint) {
        this.blueprintNames = [];
        blueprintNames.forEach(bp => {
            this.blueprintNames.push(bp);
        });

        // Adding more flexibility to handle the base blueprint
        this.baseBluePrint = baseBluePrint;

        // using relative path depending on developer project path
        this.baseUrl = path.resolve(__dirname, "..").replace("config", "");

        // used to read files and directory tree
        this.src = path.join(this.baseUrl, `/modules/blueprints/${baseBluePrint}/src/Overrides`);

        // basetheme components
        this.baseComponentsPath = path.join(this.baseUrl, `/modules/blueprints/${baseBluePrint}/src/App/Components`);

        // baseTheme json files
        this.baseJsonFiles = path.join(
            this.baseUrl,
            `/modules/blueprints/${baseBluePrint}/wwwroot/AppData/PageTemplates`,
        );

        // used to copy mobius overrides from base theme
        this.baseMobiusOverridesPath = path.join(
            this.baseUrl,
            `/modules/blueprints/${baseBluePrint}/src/MobiusOverrides`,
        );
    }

    apply(compiler) {
        // return all subDirectories of a give path
        const getDirectories = function (src, callback) {
            glob(`${src}/**/*`, callback);
        };

        function createAndWriteFile(files, dest, templateType, baseBluePrint, blueprint) {
            files.forEach(res => {
                const newPath = res.replace(`${baseBluePrint}`, `${blueprint}`);
                // componentStyles.ts will create a folder, so check for this
                if (newPath.indexOf(".tsx") === -1 && newPath.indexOf(".ts") > -1 && newPath.indexOf("index") === -1) {
                    return;
                }
                if (!(newPath.indexOf(".tsx") > -1) && !fs.existsSync(newPath) && newPath.indexOf("index") === -1) {
                    fs.mkdirSync(newPath, { recursive: true, overwrite: false });
                } else if (newPath.indexOf(".tsx") > -1 && !fs.existsSync(newPath) && newPath.indexOf("index") === -1) {
                    fse.appendFile(newPath, " ", err => {
                        if (err) {
                            throw err;
                        }
                    });

                    const importPath = path
                        .resolve(dest, newPath)
                        .replace(
                            dest,
                            templateType === "overrides"
                                ? "Overrides"
                                : templateType === "components"
                                ? "App/Components"
                                : "MobiusOverrides",
                        )
                        .replace(/\\/g, "/")
                        .replace(".tsx", "");

                    fse.readFile(newPath, "utf8", (err, data) => {
                        let output = "";
                        if (templateType === "overrides") {
                            output = `import widgetModule from \"@${baseBluePrint}/${importPath}\";\n\nexport * from \"@${baseBluePrint}/${importPath}\";\nexport default widgetModule;\n`;
                        }
                        if (templateType === "components") {
                            output = `import componentModule from \"@${baseBluePrint}/${importPath}\";\n\nexport * from \"@${baseBluePrint}/${importPath}\";\nexport default componentModule;\n`;
                        }
                        if (templateType === "mobiusOverrides") {
                            output = `import mobiusModule from \"@${baseBluePrint}/${importPath}\";\n\nexport * from \"@${baseBluePrint}/${importPath}\";\nexport default mobiusModule;\n`;
                        }
                        fse.truncateSync(newPath, 0);
                        fse.writeFile(newPath, output, err => {
                            if (err) {
                                throw err;
                            }
                        });
                    });
                    // eslint-disable-next-line no-console
                    console.log("New File Created: ", newPath);
                }
            });
        }

        // after each webpack compilation is done trigger this plugin
        compiler.hooks.done.tap("CopyBaseThemPlugin", somethingIDontCareAbout => {
            const baseBluePrint = this.baseBluePrint;

            this.blueprintNames.forEach(blueprint => {
                const destination = path.join(this.baseUrl, `/modules/blueprints/${blueprint}/src/Overrides`);
                const componentDest = path.join(this.baseUrl, `/modules/blueprints/${blueprint}/src/App/Components`);
                const baseJsonFiles = this.baseJsonFiles;
                const mobiusDesination = path.join(
                    this.baseUrl,
                    `/modules/blueprints/${blueprint}/src/MobiusOverrides`,
                );
                const jsonFiles = path.join(
                    this.baseUrl,
                    `/modules/blueprints/${blueprint}/wwwroot/AppData/PageTemplates`,
                );

                // create parent overrides directory if not found
                if (!fs.existsSync(destination)) {
                    fs.mkdirSync(destination, { recursive: true, overwrite: false });
                }
                // get parent subDirectories inside overrides => [Components, Pages, Widgets]
                const files = fse
                    .readdirSync(path.resolve(this.src))
                    .filter(f => fse.lstatSync(path.join(this.src, f)).isDirectory());

                // for each parent sub-dir inside the other blueprints, check if not found then create it
                files.forEach(file => {
                    const newParentSubDirectory = path.resolve(destination, file);
                    if (!fs.existsSync(newParentSubDirectory)) {
                        fs.mkdirSync(newParentSubDirectory);
                    }
                });

                // inside each parent sub-dir, go through each file, if directory then create it if not already created and
                // check each file inside it, if created already then pass over it and dont do actions else, create a new file with new import/export template
                // from base theme
                files.forEach(file =>
                    getDirectories(path.resolve(this.src, file), function (err, response) {
                        if (err) {
                            // eslint-disable-next-line no-console
                            console.log("Error", err);
                        } else {
                            createAndWriteFile(response, destination, "overrides", baseBluePrint, blueprint);
                        }
                    }),
                );

                // create components directory if not found
                if (!fs.existsSync(componentDest)) {
                    fs.mkdirSync(componentDest, { recursive: true, overwrite: false });
                }
                const componentsFiles = fse
                    .readdirSync(path.resolve(this.baseComponentsPath))
                    .filter(f => fse.lstatSync(path.join(this.baseComponentsPath, f)).isDirectory());

                // for each parent sub-dir inside the other blueprints, check if not found then create it
                componentsFiles.forEach(file => {
                    const newParentSubDirectory = path.resolve(componentDest, file);
                    if (!fs.existsSync(newParentSubDirectory)) {
                        fs.mkdirSync(newParentSubDirectory);
                    }
                });

                componentsFiles.forEach(file =>
                    getDirectories(path.resolve(this.baseComponentsPath, file), function (err, response) {
                        if (err) {
                            // eslint-disable-next-line no-console
                            console.log("Error", err);
                        } else {
                            createAndWriteFile(response, componentDest, "components", baseBluePrint, blueprint);
                        }
                    }),
                );

                // create mobius overrides from baseTheme
                if (!fs.existsSync(mobiusDesination)) {
                    fs.mkdirSync(mobiusDesination, { recursive: true, overwrite: false });
                }

                const mobiusFiles = fse
                    .readdirSync(path.resolve(this.baseMobiusOverridesPath))
                    .filter(f => fse.lstatSync(path.join(this.baseMobiusOverridesPath, f)).isDirectory());

                // for each parent sub-dir inside the other blueprints, check if not found then create it
                mobiusFiles.forEach(file => {
                    const newParentSubDirectory = path.resolve(mobiusDesination, file);
                    if (!fs.existsSync(newParentSubDirectory)) {
                        fs.mkdirSync(newParentSubDirectory);
                    }
                });

                mobiusFiles.forEach(file =>
                    getDirectories(path.resolve(this.baseMobiusOverridesPath, file), function (err, response) {
                        if (err) {
                            // eslint-disable-next-line no-console
                            console.log("Error", err);
                        } else {
                            createAndWriteFile(response, mobiusDesination, "mobiusOverrides", baseBluePrint, blueprint);
                        }
                    }),
                );

                // create wwwroot directory if not found
                if (!fs.existsSync(jsonFiles)) {
                    fs.mkdirSync(jsonFiles, { recursive: true, overwrite: false });
                }

                fse.copySync(baseJsonFiles, jsonFiles, { recursive: true, overwrite: false }, err => {
                    if (err) {
                        throw err;
                    } else {
                        // eslint-disable-next-line no-console
                        console.log("Json Template Copied");
                    }
                });
            });
        });
    }
}

module.exports = CopyBaseThemePlugin;
