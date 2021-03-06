/*
Copyright (c) 2012, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://yuilibrary.com/license/
*/
var util = require('../util'),
    log = require('../log'),
    timethat = require('timethat'),
    path = require('path'),
    api = require('../api'),
mods = {
    gallery: true,
    init: function(options) {
        if (util.isYUI()) {
            log.bail('command is not valid in yui repo');
        }
        log.debug('Info Command');
        var module = options.parsed.argv.remain[0],
            approve = options.parsed.approve;

        if (!module) {
            module = util.findModule();
        }
        if (!module) {
            log.bail('please provide a module name');
        }
        this.module = module;

        if (options.parsed['set-repo'] || options.parsed['set-path']) {
            this.set(options.parsed['set-repo'], options.parsed['set-path']);
            return;
        }
        if (approve) {
            this.approve();
        } else {
            this.fetch();
        }
    },
    approve: function() {
        var mod = this.module;
        util.prompt('You are sure you want to approve this module? [Y/n] ', function(ans) {
            if (ans.toLowerCase().indexOf('y') === 0 || ans === '') {
                api.post('/gallery/' + mod+ '/approve', function(err, data) {
                    if (err) {
                        log.bail(err);
                    }
                    log.info(data.message);
                });
            } else {
                log.bail('bailing');
            }
        });
    },
    fetch: function() {
        var module = this.module,
            self = this;
        log.info('showing info for ' + module);
        api.get('/gallery/' + module + '/package.json', function(err, data) {
            if (err) {
                log.bail('nothing known about ' + module);
            }
            api.get('/gallery/' + module + '/cdn/', function(e, cdn) {
                var json = data.yui;
                json.licenses = data.licenses;
                self.json = json;
                self.cdn(cdn);
            });
        });
    },
    set: function(repo, path) {
        var self = this;
        log.info('updating info for this module:');
        if (repo) {
            log.info('setting repo to: ' + repo);
        }
        if (path) {
            log.info('setting path to: ' + path);
        }
        api.put('/gallery/' + this.module + '/set', {
            repo: repo,
            path: path
        }, function(e) {
            if (e) {
                log.bail(e);
            }
            self.fetch();
        });
    },
    reports: function() {
        var json = this.json.reports,
            grover = require('grover/lib/index'),
            istanbul = require('istanbul'),
            collect, report, summary;
        if (!Object.keys(json.tests).length) {
            log.warn('this module does not provide tests');
        } else {
            log.info('latest test results\n');

            grover.status(json.tests);
            if (json.tests.coverage) {
                log.log('\n---------------------- Coverage Report ---------------------------');
                collect = new istanbul.Collector();
                report = istanbul.Report.create('text');
                summary = istanbul.Report.create('text-summary');
                
                collect.add(json.tests.coverage);
                
                log.log('');
                report.writeReport(collect);
                summary.writeReport(collect);
            }
        }
    },
    cdn: function(cdn) {
        var oncdn, since, self = this,
            repo = '';
        if (this.json.cdn && this.json.cdn.oncdn) {
            oncdn = new Date(this.json.cdn.oncdn * 1000);
            console.log('');
            log.log('   ' + this.json.cdn.github + '/' + self.module);
            console.log('');
            log.log('   module has been on the cdn since: ' + oncdn.toDateString());
            log.log('   last build tag pushed: ' + this.json.cdn.buildtag);
            if (cdn && cdn.sha1) {
                since = (new Date(cdn.stamp * 1000)).toDateString();
                repo = 'git://github.com/' + this.json.cdn.github  + '/' + this.json.cdn.repo + '.git';
                log.log('   currently in the CDN Queue since ' + since);
                console.log('');
                log.log('       stamp:      ' + new Date(cdn.stamp * 1000));
                log.log('       sha:        ' + cdn.sha1);
                log.log('       repo:       ' + repo);
                log.log('       message:    ' + cdn.message);
                console.log('');
                log.log('       clone this request:');
                log.log('           git clone ' + repo);
                log.log('           cd ' + path.join(self.json.cdn.repo, self.json.cdn.path));
                log.log('           git checkout ' + cdn.sha1.substr(0, 7));
                console.log('');
                util.getCDNWindow(function(str) {
                    log.log('   ' + str);
                    console.log('');
                    self.reports();
                    console.log('');
                });
            } else {
                repo = 'git://github.com/' + this.json.cdn.github  + '/' + this.json.cdn.repo + '.git';
                console.log('');
                log.log('       clone this module:');
                log.log('           git clone ' + repo);
                log.log('           cd ' + path.join(self.json.cdn.repo, self.json.cdn.path));
                console.log('');
                util.getCDNWindow(function(str) {
                    log.log('   ' + str);
                    console.log('');
                    self.reports();
                    console.log('');
                });
            }
        } else {
            if (!this.json.module.approved) {
                log.log('-----------------------------------------------------');
                log.warn('this module is still pending approval'.red);
                log.log('-----------------------------------------------------');
            } else {
                if (this.json.licenses[0].type === 'YUI BSD') {
                    log.warn('this module is not on the cdn');
                } else {
                    log.error('this module\'s license prohibits CDN deployment');
                    log.error('type     : ' + this.json.licenses[0].type);
                    log.error('url      : ' + this.json.licenses[0].url);
                }
            }
            console.log('');
            log.log('   ' + this.json.cdn.github + '/' + self.module);
            console.log('');
            repo = 'git://github.com/' + this.json.cdn.github + '/' + this.json.cdn.repo + '.git';
            log.log('       created: ' + (new Date(this.json.module.created * 1000)));
            if (!this.json.module.approved) {
                log.log('       pending for: ' + timethat.calc((new Date(this.json.module.created * 1000)), new Date()));
            }
            log.log('       clone this module:');
            log.log('           git clone ' + repo);
            log.log('           cd ' + path.join(this.json.cdn.repo, this.json.cdn.path));
            console.log('');
        }
    },
    help: function() {
        return [
            'info <module>',
            'show module information',
            '--set-repo=<repo> Set the name of the repo if you do not use yui3-gallery',
            '--set-path=<path> Set the path to the module under the repo, defaults to src/',
            '--approve Request module approval'
        ];
    }
};

util.mix(exports, mods);

