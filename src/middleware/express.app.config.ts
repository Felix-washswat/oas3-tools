'use strict';

import * as express from 'express';
import * as path from 'path';
import cookieParser = require('cookie-parser');
import bodyParser = require('body-parser');
import  { SwaggerUI } from './swagger.ui';
import  { SwaggerRouter } from './swagger.router';
import  { SwaggerParameters } from './swagger.parameters';
import * as logger from 'morgan';
import * as fs from 'fs';
import * as jsyaml from 'js-yaml';
import { OpenApiValidator } from 'express-openapi-validator';

export class ExpressAppConfig {
    private app: express.Application;
    private definitionPath: string;
    private routingOptions;

    constructor(definitionPath: string, appOptions) {
        this.definitionPath = definitionPath;
        this.routingOptions = appOptions.routing;
        this.app = express();

        const spec = fs.readFileSync(definitionPath, 'utf8');
        const swaggerDoc = jsyaml.safeLoad(spec);

        this.app.use(bodyParser.urlencoded());
        this.app.use(bodyParser.text());
        this.app.use(bodyParser.json());

        this.app.use(this.configureLogger(appOptions.logging));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: false }));
        this.app.use(cookieParser());

        const swaggerUi = new SwaggerUI(swaggerDoc, appOptions);
        this.app.use(swaggerUi.serveStaticContent());
    }

    public addValidator() {
        new OpenApiValidator({
            apiSpec: this.definitionPath,
        })
            .install(this.app)
            .then(() => {
                this.app.use(new SwaggerParameters().checkParameters());
                this.app.use(new SwaggerRouter().initialize(this.routingOptions));

                this.app.use((err, req, res, next) => {
                    // format errors
                    res.status(err.status || 500).json({
                        message: err.message,
                        errors: err.errors,
                    });
                });
            });
    }

    public configureLogger(loggerOptions){
        let format = 'dev';
        if(loggerOptions.format != undefined
            && typeof loggerOptions.format === 'string'){
                format = loggerOptions.format;
        }

        let options:{} = {};
        if(loggerOptions.errorLimit != undefined
            && (typeof loggerOptions.errorLimit === 'string' || typeof loggerOptions.errorLimit === 'number')){
            options['skip'] = function (req, res) { return res.statusCode < parseInt(loggerOptions.errorLimit); };
        }

        return logger(format, options);
    }

    public getApp(): express.Application {
        return this.app;
    }
}
