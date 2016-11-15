/*

 Österreich ESF 2007-2013 - ähnlich wie bei Rheinland-Pfalz - mehrere PDFs (pro Jahr) die gepoolt werden müssen
 https://github.com/os-data/eu-structural-funds/issues/42

 http://www.esf.at/esf/wp-content/uploads/Verzeichnis-der-Beg%C3%BCnstigten-2014.pdf
 http://www.esf.at/esf/wp-content/uploads/Liste-der-ESF-Beguenstigten-2013.pdf
 http://www.esf.at/esf/wp-content/uploads/Liste-der-ESF-Beg%C3%BCnstigten-2012.pdf
 http://www.esf.at/esf/wp-content/uploads/20120827_Liste-der-ESF-Beg%C3%BCnstigten-20111.pdf
 http://www.esf.at/esf/wp-content/uploads/2010-ESF_Verzeichnis_Beg%C3%BCnstigte_%C3%96sterreich.pdf
 http://www.esf.at/esf/wp-content/uploads/2011/02/List-of-Beneficiaries_2009.pdf
 http://www.esf.at/esf/wp-content/uploads/ESF-List-of-Beneficiaries-Austria-2007-2008.pdf

 */

var scrapyard = require("scrapyard");
var async = require("async");
var path = require("path");
var request = require("request");
var PDFParser = require("pdf2json");
var fs = require("fs");
var PDFToolbox = require('../../lib/pdftoolbox');

var Format2012 = function () {
	//wow, this one is messy.
	// 1. get horizontal lines & content from pdf2json
	// 2. extract contents between _long_ lines
	// 3. morph to line collection to individual lines (1 beneficiary with multiple entries)

	// var _VALUE = PDFToolbox.FIELDS.VALUE1;
	// var _TEXT = function (cell) {
	// 	return cell && !_VALUE(cell);
	// };
	// var rowspecs = [
	// 	[_TEXT, _TEXT, _VALUE]
	// ];

	var parsePDF = function (item, cb) {
		var filename = path.basename(item.url).replace('.pdf', '');
		console.log('scraping pdf', filename);
		var f = filename + '.raw.json';
		if (fs.existsSync(f)) {
			return cb(null, JSON.parse(fs.readFileSync(f).toString()))
		}
		var pdfParser = new PDFParser();
		pdfParser.on("pdfParser_dataError", function (errData) {
			console.error(errData.parserError);
		});
		pdfParser.on("pdfParser_dataReady", function (pdfData) {
			pdfData.formImage.Pages.forEach(function (page, i) {
				page.nr = i + 1;
			});
			fs.writeFileSync(f, JSON.stringify(pdfData, null, '\t'));
			cb(null, pdfData);
		});
		pdfParser.loadPDF(filename + '.pdf');
	};

	this.scrapePDF = function (item, cb) {
		parsePDF(item, function (err, pdfData) {

			var diff = 0.5;// 0.975;
			var lines = [];

			pdfData.formImage.Pages.forEach(function (page) {
				page.Texts =
					page.Texts.filter(function (item) {
						var str = decodeURIComponent(item.R[0].T);
						return [
								'',
								'Bundesministerium für Unterricht, Kunst und Kultur',
								'Bundesministerium für Arbeit, Soziales und Konsumentenschutz',
								'Arbeitsmarktservice',
								'PUSCHMANN', //is duplicated as single item by component
								'Land Kärnten',
								'Land Niederösterreich',
								'Land Oberösterreich',
								'Land Salzburg',
								'Land Tirol',
								'Land Steiermark',
								'Land Vorarlberg',
								'Schwerpunkt 1',
								'Schwerpunkt 2',
								'Schwerpunkt 5',
								'Schwerpunkt 6',
								'Schwerpunkt 3b (3. Runde)',
								'Wiener ArbeitnehmerInnen Förderungsfonds (WAFF)'
							].indexOf(str) < 0;
					});


				var hlines = page.HLines.filter(function (hline) {
					return hline.l > 16;
				});
				var lasty = hlines[0].y - diff;
				var above = page.Texts.filter(function (text) {
					return (text.y < lasty);
				});
				lines.push(above);
				hlines.forEach(function (hline) {
					var collect = page.Texts.filter(function (text) {
						return (text.y >= lasty) && (text.y < hline.y - diff);
					});
					lines.push(collect);
					lasty = hline.y - diff;
				});
				var below = page.Texts.filter(function (text) {
					return (text.y >= lasty);
				});
				lines.push(below);
			});

			var condens = lines.map(function (line) {
				return line.map(function (item) {
					return {x: item.x, y: item.y, width: item.w, str: decodeURIComponent(item.R[0].T)};
				});
			});

			var extractColumns = function (lines, columns, maxdiff) {

				var getCol = function (x) {
					var col = 0;
					for (var i = columns.length; i >= 0; i--) {
						if (x < columns[i]) col = i;
					}
					return col;
				};

				return lines.map(function (line, linenr) {
					var row = [];
					line.forEach(function (cell, j) {
						var x = cell.x;
						var col = getCol(x);
						cell.col = col;
						if (col == 2 && PDFToolbox.FIELDS.INT(cell.str) && (linenr == lines.length - 1)) {
							// console.log('ignoring page number', cell.str);
						} else {
							while (row.length <= col) {
								row.push(null);
							}
							row[col] = row[col] || [];
							row[col].push(cell);
						}
					});
					return row;
				});
			};

			var rows = condens.map(function (line) {
				return extractColumns([line], [30, 40, 1200], 0.1)[0];
			});
			var count = 0;
			var expand_rows = [];
			rows.forEach(function (row) {
				if (row[0] && row[0].length == 1 &&
					row[1] && row[1].length == 1 &&
					row[2] && row[2].length == 1) {
					expand_rows.push([row[0][0].str, row[1][0].str, row[2][0].str]);
					// expand_rows.push(['ok']);
				} else if (row[0] && row[0].length == 1 &&
					row[1] && row[1].length > 1 &&
					row[2] && row[2].length > 1 &&
					row[1].length == row[2].length) {
					for (var i = 0; i < row[1].length; i++) {
						expand_rows.push([row[0][0].str, row[1][i].str, row[2][i].str]);
						// expand_rows.push(['ok']);
					}
				} else if (row[0] && row[0].length > 0 &&
					row[1] && row[1].length > 0 &&
					row[2] && row[2].length > 0) {

					var items = [];
					row.forEach(function (cellcontent) {
						if (cellcontent)
							items = items.concat(cellcontent);
					});
					var lines = PDFToolbox.utils.contentToLines(items, 0.12);
					var r = PDFToolbox.utils.extractColumnRows(lines, [30, 40, 1200], 0.1);

					var countrows = function (col) {
						var result = 0;
						r.forEach(function (r2) {
							if (r2[col]) result++;
						});
						return result;
					};

					if (countrows(2) == 1 && countrows(0) == 1) {
						var newrow = [null, null, null];
						r.forEach(function (r2) {
							for (var i = 0; i <= 2; i++) {
								if (r2[i]) {
									newrow[i] = (newrow[i] ? newrow[i] + '\t' : '') + r2[i];
								}
							}
						});
						expand_rows.push(newrow);
					} else {
						var col0 = null;
						r.forEach(function (r2) {
							if (r2[0]) {
								col0 = (col0 ? col0 + '\t' : '') + r2[0];
							}
						});
						var newrows = [];
						var newrow = [];
						newrows.push(newrow);
						r.forEach(function (r2) {
							if (r2[2]) {
								newrow = [col0, r2[1], r2[2]];
								newrows.push(newrow);
							} else {
								newrow[1] = (newrow[1] ? newrow[1] + '\t' : '') + r2[1];
							}
						});
						console.log('------');
						newrows.forEach(function(newrow){
							console.log(JSON.stringify(newrow));
						});
						console.log(r.map(function (row) {
							return JSON.stringify(row);
						}));
						expand_rows.push(['-start--------------------------------------']);
						expand_rows.push(row.map(function (cell) {
							return cell ? cell.map(function (part) {
								return part.str;
							}).join('\n') : null;
						}));
						expand_rows.push(['-end----------------------------------------']);
						count++;
					}
				} else {
					expand_rows.push(row.map(function (cell) {
						return cell ? cell.map(function (part) {
							return part.str;
						}).join('\n') : null;
					}));
					count++;

				}
			});
			console.log('todo', count);
			var filename = path.basename(item.url).replace('.pdf', '.manual.json');
			fs.writeFileSync(filename, JSON.stringify(expand_rows, null, '\t'));

		});

	};
};

var Format2013 = function () {
	var _VALUE = PDFToolbox.FIELDS.VALUE1;
	var _TEXT = function (cell) {
		return cell && !_VALUE(cell);
	};
	var rowspecs = [
		[_TEXT, _TEXT, _VALUE]
	];

	this.scrapePDF = function (item, cb) {
		var pdf = new PDFToolbox();
		pdf.scrape(item.url, {
			debug: false,
			skipPage: [],
			pageToLines: function (page) {
				var lines = PDFToolbox.utils.pageToLines(page, 4);
				if (page.pageInfo.num == 1) {
					lines = PDFToolbox.utils.extractLines(lines, ['Euro'], ['-------------'/* take all */]);
				}
				if (lines.length > 0 && lines[lines.length - 1].length == 1) {
					//skipping page footer
					lines = lines.slice(0, lines.length - 1);
				}
				return lines;
			},
			processLines: function (lines) {
				return lines;
			},
			linesToRows: function (lines) {
				// console.log(PDFToolbox.utils.xStats(page));
				/*

				 0-300 col 1
				 Beneficiary

				 300-600 col 2
				 Name of the operation

				 600- col 3
				 EU-, national and private funding*
				 * total cost

				 */

				return PDFToolbox.utils.extractColumnRows(lines, [300, 600, 1200], 5);
			},
			processRows: function (rows) {
				rows = PDFToolbox.utils.mergeMultiRowsBottomToTop(rows, 2, [0, 1]);
				return rows.filter(function (row) {
					if (!PDFToolbox.utils.isValidRow(row, rowspecs)) {
						console.log('ALARM, invalid row', JSON.stringify(row));
						return false;
					} else {
						return true;
					}
				});
			},
			rowToFinal: function (row) {
				return {
					_source: item.url,
					beneficiary: row[0] || '',
					name_of_operation: row[1] || '',
					funding_total_cost: row[2] || ''
				};
			},
			processFinal: function (items) {
				return items;
			}
		}, function (err, items) {
			if (err) console.log(err);
			cb();
		});
	};
};

var Format2014 = function () {
	var _VALUE = PDFToolbox.FIELDS.VALUE1;
	var _TEXT = function (cell) {
		return cell && !_VALUE(cell);
	};
	var rowspecs = [
		[_TEXT, _TEXT, _VALUE]
	];

	this.scrapePDF = function (item, cb) {
		var pdf = new PDFToolbox();
		pdf.scrape(item.url, {
			debug: false,
			skipPage: [],
			pageToLines: function (page) {
				var lines = PDFToolbox.utils.pageToLines(page, 4);
				if (page.pageInfo.num == 1) {
					lines = PDFToolbox.utils.extractLines(lines, ['Begünstigte/r'], ['-------------'/* take all */]);
				}
				if (lines.length > 0 && lines[lines.length - 1].length >= 7 && lines[lines.length - 1][1].str == 'Seite ') {
					//skipping page footer
					lines = lines.slice(0, lines.length - 1);
				}
				return lines;
			},
			processLines: function (lines) {
				return lines;
			},
			linesToRows: function (lines) {
				// console.log(PDFToolbox.utils.xStats(page));
				/*

				 0-300 col 1
				 Begünstigte/r

				 300-600 col 2
				 Bezeichnung des Vorhabens

				 600- col 3
				 Öffentliche Beteiligung

				 */

				return PDFToolbox.utils.extractColumnRows(lines, [400, 675, 1200], 5);
			},
			processRows: function (rows) {
				rows = PDFToolbox.utils.mergeMultiRowsBottomToTop(rows, 2, [0, 1]);
				return rows.filter(function (row) {
					if (!PDFToolbox.utils.isValidRow(row, rowspecs)) {
						console.log('ALARM, invalid row', JSON.stringify(row));
						return false;
					} else {
						return true;
					}
				});
			},
			rowToFinal: function (row) {
				return {
					_source: item.url,
					beneficiary: row[0] || '',
					name_of_operation: row[1] || '',
					public_funding: row[2] || ''
				};
			},
			processFinal: function (items) {
				return items;
			}
		}, function (err, items) {
			if (err) console.log(err);
			cb();
		});
	};
};

var scrapePDF = function (item, next) {
	if (item.format) {
		item.format = new item.format();
		item.format.scrapePDF(item, next);
	} else {
		console.log('TODO: format for ', item.url);
		next();
	}
};

var scrapeItem = function (item, next) {
	var filename = path.basename(item.url);
	if (!fs.existsSync(filename)) {
		console.log('scraping doc', item.url);
		var req = request(item.url);
		var stream = req.pipe(fs.createWriteStream(filename));
		stream.on('close', function () {
			scrapePDF(item, next);
		});
	} else {
		scrapePDF(item, next);
	}
};

var list = [
	{url: 'http://www.esf.at/esf/wp-content/uploads/Verzeichnis-der-Beg%C3%BCnstigten-2014.pdf', format: Format2014},
	{url: 'http://www.esf.at/esf/wp-content/uploads/Liste-der-ESF-Beguenstigten-2013.pdf', format: Format2013},
	// {url: 'http://www.esf.at/esf/wp-content/uploads/Liste-der-ESF-Beg%C3%BCnstigten-2012.pdf', format: Format2012},

	// {url: 'http://www.esf.at/esf/wp-content/uploads/20120827_Liste-der-ESF-Beg%C3%BCnstigten-20111.pdf', format: null},
	// {url: 'http://www.esf.at/esf/wp-content/uploads/2010-ESF_Verzeichnis_Beg%C3%BCnstigte_%C3%96sterreich.pdf', format: null},
	// {url: 'http://www.esf.at/esf/wp-content/uploads/2011/02/List-of-Beneficiaries_2009.pdf', format: null},
	// {url: 'http://www.esf.at/esf/wp-content/uploads/ESF-List-of-Beneficiaries-Austria-2007-2008.pdf', format: null}
];

async.forEachSeries(list, scrapeItem, function () {
	console.log('done');
});
