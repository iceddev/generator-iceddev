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
        default: this._fromPackage('name', this.appname)
      },
      {
        type: 'input',
        name: 'version',
        message: 'version:',
        default: this._fromPackage('version', '0.0.0')
      },
      {
        type: 'input',
        name: 'description',
        message: 'description:',
        default: this._fromPackage('description')
      },
      {
        type: 'input',
        name: 'author',
        message: 'author:',
        default: this._fromPackage('author', this._findAuthor()),
        store: true
      },
      {
        type: 'input',
        name: 'repository',
        message: 'repository:',
        default: this._fromPackage('repository', this._findRemote())
      },
      {
        type: 'input',
        name: 'license',
        message: 'license:',
        default: this._fromPackage('license', this._findLicense())
      },
      {
        type: 'input',
        name: 'main',
        message: 'entry point:',
        default: this._fromPackage('main', 'index.js')
      },
      {
        type: 'input',
        name: 'files',
        message: 'files in release:',
        default: this._fromPackage('files')
      },
      {
        type: 'input',
        name: 'test',
        message: 'test command:',
        default: this._fromPackage('scripts.test')
      },
      {
        type: 'input',
        name: 'keywords',
        message: 'keywords:',
        default: this._fromPackage('keywords')
      }
    ];

    this.prompt(prompts, function (props) {
      var pkg = this.pkg;

      _.assign(pkg, props);

      pkg.files = this._formatFiles(pkg.files);

      pkg.keywords = this._formatKeywords(pkg.keywords);

      pkg.description = pkg.description || '';

      pkg.test = pkg.test || 'echo \"Error: no test specified\" && exit 1';

      var contributors = this.originalPkg.contributors || [];
      pkg.contributors = this._formatList(contributors);

      console.log(pkg);

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
      var orig = getobject(this.originalPkg, key);

      if(_.isArray(orig)){
        return orig.join();
      }

      if(_.isString(orig)){
        return orig;
      }

      return JSON.stringify(orig);
    }

    return fallback;
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
    console.log(files);

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

    return JSON.stringify(output, null, 4).replace(']', '  ]');
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
