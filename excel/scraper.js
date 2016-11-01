var fs = require('fs');
var path = require('path');
var moment = require('moment');
var async = require('async');
var XLSX = require('xlsx-extract').XLSX;
var mkdirp = require('mkdirp');
var yaml = require('yamljs');

var walkSync = function (dir, filelist, ext) {
	var files = fs.readdirSync(dir);
	filelist = filelist || [];
	files.forEach(function (file) {
		if (fs.statSync(path.join(dir, file)).isDirectory()) {
			filelist = walkSync(path.join(dir, file), filelist, ext);
		}
		else {
			if (path.extname(file) == ext)
				filelist.push(path.join(dir, file));
		}
	});
	return filelist;
};

var config = {
	'/BE.belgium/BE2.vlaams.gewest/ERDF 2007-2013/ERDF_Flandern_2007-2013.xlsx': {
		header: 1
	},
	'/DE.germany/DE3.berlin/ERDF 2007-2013/Berlin ERDF 2007-2013.xlsx': {
		header: 1
	},
	'/DE.germany/DE4.brandenburg/ESF 2014-2020/ESF Data Brandenburg 2014-2020.xlsx': {
		header: 4,
		footer: 12
	},
	'/DE.germany/DE3.berlin/ERDF 2014-2020/ERDF_Berlin_2014-2020.xlsx': {
		header: 4,
		footer: 6
	},
	'/DE.germany/DE2.bayern/ERDF 2007-2013/Transparenzliste_FIPS2007_31_12_2015_bayern.xlsx': {
		header: 3
	},
	'/PT.portugal/all_funds_2007-2013/Portugal_all_funds_2007-2013.xlsx': {
		header: 1,
		footer: 1
	},
	'/DE.germany/DE5.bremen/ERDF 2014-2020/ERDF_Bremen_2014-2020.xlsx': {
		header: 3,
		footer: 1
	},
	'/PT.portugal/all_funds_2014-2020/Portugal_all_funds_2014-2020.xlsx': {
		header: 1
	},
	'/DE.germany/DEF.schleswig-holstein/ESF 2014-2020/ldv.xlsx': {
		header: 7,
		footer: 1
	},
	'/SI.slovenia/2007-2013/upravicenci-vsi-4-07-2016-uvoz.xlsx': {
		header: 1,
		footer: 40
	},
	'/CZ.czech-republic/2007-2013/ERDF_Czech_Republic_2007-2013.xlsx': {
		header: 1
	},
	'/DE.germany/DEA.nordrhein-westfalen/ESF 2014-2020/ESF_NRW_2014-2020.xlsx': {
		header: 8
	},
	'/DE.germany/DEB.rheinland-pfalz/ERDF 2014-2020/ERDF_Rheinland_Pfalz_2014-2020.xlsx': {
		header: 4
	},
	'/DE.germany/DEB.rheinland-pfalz/ESF 2014-2020/ESF_Rheinland_Pfalz_2014-2020.xlsx': {
		header: 3,
		footer: 1
	},
	'/DE.germany/DEC.saarland/ESF 2014-2020/Vorhabenliste-25-05-2016_Saarland.xlsx': {
		header: 14,
		footer: 537
	},
	'/DE.germany/DEA.nordrhein-westfalen/ERDF 2014-2020/ERDF_NRW_2014-2020.xlsx': {
		header: 5,
		footer: 3
	},
	'/DE.germany/DE9.niedersachsen/ERDF 2014-2020/ERDF_Niedersachsen_2014-2020.xlsx': {
		header: 8
	},
	'/DE.germany/DE9.niedersachsen/ESF 2014-2020/ESF_Niedersachsen_2014-2020.xlsx': {
		header: 8
	},
	'/DE.germany/DE6.hamburg/ESF 2014-2020/ESF Data Hamburg 2014-2020.xlsx': {
		header: 3,
		footer: 40
	}
};


var repropath = '../eu-structural-funds/data';
var list = walkSync(repropath, [], '.xlsx');

console.log('--------------------');
async.forEachSeries(list,
	function (filename, next) {
		var dest = filename.replace(repropath, '');
		var basepath = path.dirname(dest);
		var basename = path.basename(dest);
		if (!fs.existsSync(repropath + basepath + '/source.description.yaml')) {
			console.log(dest + '\nno source.description.yaml found');
			console.log('--------------------');
			return next();
		}
		var conf = yaml.parse(fs.readFileSync(repropath + basepath + '/source.description.yaml').toString());
		var def = null;
		var done = false;
		conf.resources.forEach(function (r) {
			if (r.path) {
				if (r.path.indexOf(basename) >= 0) {
					def = r;
				}
				else if (r.path.indexOf(basename.replace('.xlsx', '.json')) >= 0) {
					done = true;
				}
			}
		});
		if (done) {
			return next();
		}
		if (!def) {
			console.log(dest + '\nfile not found in spec');
			console.log('--------------------');
			next();
		} else {
			console.log(dest + '\nworking');
			var c = config[dest];
			var rows = [];
			new XLSX().extract(filename, {
				sheet_id: 1,
				ignore_header: c ? c.header : 0,
				// raw_values: true,
				format: 'obj',
				convert_values: { // apply cell number formats or not
					ints: false,  // rounds to int if number format is for int
					floats: true,  // rounds floats according to float number format
					dates: true,   // converts xlsx date to js date
					bools: true   // converts xlsx bool to js boolean
				}
			}).on('row', function (row) {
				rows.push(row.cells.map(function (cell) {
					if (cell == null || cell.val == null) return '';
					// console.log(cell);
					if (cell.fmt && cell.fmt.fmt && cell.fmt.fmt.indexOf('€') >= 0 && (typeof cell.val !== 'string')) {
						return '€ ' + cell.val.toFixed(2);
					}
					if (cell.fmt && cell.fmt.fmt) {
						// console.log(cell.fmt.fmt);
						if ((cell.fmt.fmt == '0\\ %' || cell.fmt.fmt == '0%') && (typeof cell.val !== 'string')) {
							return (cell.val * 100) + '%';
						}
					}
					if (typeof cell.val == 'object') {
						var result = moment(cell.val).format('DD.MM.YYYY');
						if (result == 'Invalid date') return '';
						return result;
					}
					return cell == null ? '' : cell.val.toString();
				}));
			})
				.on('error', function (err) {
					console.error('error', filename, err);
				})
				.on('end', function (err) {
					if (c && c.footer) {
						rows = rows.splice(0, rows.length - c.footer);
					}
					console.log('rows.length', rows.length, c);
					rows = rows.map(function (row) {
						var result = {};
						def.schema.fields.forEach(function (field, i) {
							result[field.name] = row[i];
						});
						return result;
					});

					fs.writeFileSync(filename.replace('.xlsx', '.json'), JSON.stringify(rows, null, '\t'));
					console.log('--------------------');
					next();
				});
		}
	},
	function () {
		console.log('done');
	}
);

// var list2 = walkSync(repropath, [], '.xls');
// console.log(list2);
