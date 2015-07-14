'use strict';

var fs = require('fs');
var path = require('path');

var _ = require('lodash');
var gh = require('github-url-to-object');
var shell = require('shelljs');
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var yosay = require('yosay');
var getobject = require('getobject').get;
var identifyLicense = require('nlf/lib/license-find');

module.exports = yeoman.generators.Base.extend({
  initializing: function () {
    this.pkg = {};
    try {
      this.originalPkg = require(path.join(this.destinationPath(), 'package.json'));
    } catch(e){}
  },

  prompting: function () {
    var done = this.async();

    // Have Yeoman greet the user.
    this.log(yosay(
      'Welcome to the badass ' + chalk.red('Iceddev') + ' generator!'
    ));

    var prompts = [
      {
        type: 'input',
        name: 'name',
        message: 'name:',
        default: this._defaultFromPackage('name', _.kebabCase(this.appname))
      },
      {
        type: 'input',
        name: 'version',
        message: 'version:',
        default: this._defaultFromPackage('version', '0.0.0')
      },
      {
        type: 'input',
        name: 'description',
        message: 'description:',
        default: this._defaultFromPackage('description')
      },
      {
        type: 'input',
        name: 'author',
        message: 'author:',
        default: this._defaultFromPackage('author', this._findAuthor()),
        store: true
      },
      {
        type: 'input',
        name: 'repository',
        message: 'repository:',
        default: this._findRemote()
      },
      {
        type: 'input',
        name: 'license',
        message: 'license:',
        default: this._defaultFromPackage('license', this._findLicense())
      },
      {
        type: 'input',
        name: 'main',
        message: 'entry point:',
        default: this._defaultFromPackage('main', 'index.js')
      },
      {
        type: 'input',
        name: 'files',
        message: 'files in release:',
        default: this._defaultFromPackage('files')
      },
      {
        type: 'input',
        name: 'test',
        message: 'test command:',
        default: this._defaultFromPackage('scripts.test')
      },
      {
        type: 'input',
        name: 'keywords',
        message: 'keywords:',
        default: this._defaultFromPackage('keywords')
      },
      {
        type: 'confirm',
        name: 'babel',
        message: 'use babel?',
        default: true
      }
    ];

    this.prompt(prompts, function (props) {
      var pkg = this.pkg;

      _.assign(pkg, props);

      pkg.files = this._formatFiles(pkg.files);

      if(!pkg.test){
        if(props.babel){
          pkg.test = 'eslint src/**/*.js';
        } else {
          pkg.test = 'eslint **/*.js';
        }
      }

      pkg.keywords = this._formatKeywords(pkg.keywords);

      pkg.description = pkg.description || '';

      var contributors = this._fromPackage('contributors', []);
      pkg.contributors = this._formatList(contributors);

      pkg.dependencies = this._defaultFromPackage('dependencies', {});

      var scripts = {
        test: pkg.test
      };

      var devDepDefaults = {
        'eslint': '^0.23.0'
      };
      if(props.babel){
        devDepDefaults.babel = '^5.5.8';
        scripts.build = 'babel ./src/ --out-dir ./';
        scripts.prepublish = 'npm run build';
      }

      pkg.scripts = this._objectToString(scripts);

      pkg.devDependencies = this._defaultFromPackage('devDependencies', devDepDefaults);

      done();
    }.bind(this));
  },

  writing: {
    app: function () {
      this.fs.copyTpl(
        this.templatePath('_package.json'),
        this.destinationPath('package.json'),
        this.pkg
      );
    },

    projectfiles: function () {
      this.fs.copy(
        this.templatePath('editorconfig'),
        this.destinationPath('.editorconfig')
      );
      this.fs.copy(
        this.templatePath('gitignore'),
        this.destinationPath('.gitignore')
      );
      this.fs.copy(
        this.templatePath('eslintrc'),
        this.destinationPath('.eslintrc')
      );
      this.fs.copy(
        this.templatePath('travis.yml'),
        this.destinationPath('.travis.yml')
      );
    }
  },

  install: function () {
    this.installDependencies({
      bower: false,
      skipInstall: this.options['skip-install']
    });
  },

  _fromPackage: function(key, fallback){
    if(this.originalPkg){
      return getobject(this.originalPkg, key);
    }

    return fallback;
  },

  _defaultFromPackage: function(key, fallback){
    var def = this._fromPackage(key, fallback);

    if(def == null){
      return def;
    }

    if(_.isArray(def)){
      return def.join();
    }

    if(_.isString(def)){
      return def;
    }

    return this._objectToString(def);
  },

  _objectToString: function(obj){
    return JSON.stringify(obj, null, 4).replace('\n}', '\n  }');
  },

  _findAuthor: function(){
    return this.user.git.name() + ' <' + this.user.git.email() + '> (http://iceddev.com)';
  },

  _findRemote: function(){
    var remote;

    if(shell.which('git')){
      remote = gh(shell.exec('git config --get remote.origin.url', { silent: true }).output.trim());
    }

    if(remote){
      return remote.user + '/' + remote.repo;
    }
  },

  _formatFiles: function(input){
    var licenses = this._findLicenseFiles();

    if(input){
      input = input.split(/,|\s/);
    }

    var files = _.union(input, licenses, this.main);

    return this._formatList(files);
  },

  _formatKeywords: function(input){
    var keywords = [];

    if(input){
      keywords = input.split(',');
    }

    return this._formatList(keywords);
  },

  _formatList: function(list){
    var output = _(list)
      .compact()
      .map(_.trim)
      .unique()
      .sortBy()
      .value();

    return JSON.stringify(output, null, 4).replace('\n]', '\n  ]');
  },

  _findLicenseFiles: function(){
    var dest = this.destinationRoot();

    var files = fs.readdirSync(dest).filter(function(filename){
      filename = filename.toUpperCase();
      return filename.indexOf('LICENSE') > -1 || filename.indexOf('LICENCE') > -1;
    });

    return files;
  },

  _findLicense: function(){
    var dest = this.destinationRoot();

    var files = this._findLicenseFiles();

    var license = files.reduce(function(result, filename){
      var licenseFile = path.join(dest, filename);

      if (fs.lstatSync(licenseFile).isFile()) {
        return identifyLicense(fs.readFileSync(licenseFile, 'utf8'));
      }

      return result || null;
    }, null);

    return license;
  }
});
