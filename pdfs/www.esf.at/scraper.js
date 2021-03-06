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

var Format20078 = function () {
	// different pdfs mixed into one
	// 1. extract rows, combine by hand

	this.scrapePDF = function (item, cb) {
		var pdf = new PDFToolbox();
		pdf.scrape(item.url, {
			debug: true,
			skipPage: [],
			pageToLines: function (page) {
				var lines = PDFToolbox.utils.pageToLines(page, 4);
				if (page.pageInfo.num == 1) {
					lines = PDFToolbox.utils.extractLines(lines, ['Arbeitsmarkts', 'ervice ', '–', ' ', 'OP Beschäftigung ', ' '], ['-------------'/* take all */]);
				} else if (page.pageInfo.num == 3) {
					lines = PDFToolbox.utils.extractLines(lines, ['Arbeitsmarkt', 'service ', '–', ' ', 'OP Beschäftigung Betriebe ', ' '], ['-------------'/* take all */]);
				} else if (page.pageInfo.num == 208) {
					lines = PDFToolbox.utils.extractLines(lines, ['BMASK  ', ' '], ['GESAMT ', ' ', ' ', '517.844,52', ' ']);
				} else if (page.pageInfo.num == 209) {
					lines = PDFToolbox.utils.extractLines(lines, ['BMASK', ' ', '/ Abteilung ', 'IV/6', ' ', ' '], ['-------------'/* take all */]);
				} else if (page.pageInfo.num == 212) {
					lines = lines.slice(0, lines.length - 2);
				} else if (page.pageInfo.num == 213) {
					lines = PDFToolbox.utils.extractLines(lines, ['BMUKK ', '-', ' ', 'Schule', ' '], ['-------------'/* take all */]);
				} else if (page.pageInfo.num == 220) {
					lines = PDFToolbox.utils.extractLines(lines, ['BMUKK ', '–', ' ', 'Erwachsenenbildung', ' '], ['-------------'/* take all */]);
				} else if (page.pageInfo.num == 222) {
					lines = PDFToolbox.utils.extractLines(lines, ['BMWJ ', '–', ' ', 'Wissenschaft', ' '], ['-------------'/* take all */]);
				} else if (page.pageInfo.num == 223) {
					lines = PDFToolbox.utils.extractLines(lines, ['Land Niederösterreich', ' '], ['-------------'/* take all */]);
				} else if (page.pageInfo.num == 224) {
					lines = PDFToolbox.utils.extractLines(lines, ['Land Salzburg', ' '], ['-------------'/* take all */]);
				} else if (page.pageInfo.num == 225) {
					lines = PDFToolbox.utils.extractLines(lines, ['Land Tirol', ' '], ['-------------'/* take all */]);
				} else if (page.pageInfo.num == 226) {
					lines = PDFToolbox.utils.extractLines(lines, ['Schwerpunkt 5', ' '], ['-------------'/* take all */]);
					lines = lines.filter(function (line) {
						return line.length !== 2 || line[0].str !== 'Schwerpunkt 3b';
					});
				} else if (page.pageInfo.num == 227) {
					lines = PDFToolbox.utils.extractLines(lines, ['WAFF ', '–', ' ', 'Wiener ArbeitnehmerInnenförderungsfonds', ' '], ['-------------'/* take all */]);
					// console.log(lines.map(PDFToolbox.utils.lineToRow));
				}
				return lines;
			},
			processLines: function (lines) {
				return lines;
			},
			pageLinesToRows: function (lines, page) {
				// console.log(PDFToolbox.utils.xStats(page));
				/*

				 0-300 col 1
				 Begünstigte/r

				 300-600 col 2
				 Bezeichnung des Vorhabens

				 600- col 3
				 Öffentliche Beteiligung

				 */
				lines.forEach(function (line, i) {
					if (line[line.length - 1].str == ' ') {
						lines[i] = line.slice(0, line.length - 1);
					}
				});
				var pagenr = page.pageInfo.num;
				if (pagenr < 50) {
					return PDFToolbox.utils.extractColumnRows(lines, [300, 700, 1200], 5);
				} else if (pagenr < 209) {
					return PDFToolbox.utils.extractColumnRows(lines, [430, 700, 1200], 5);
				} else if (pagenr < 213) {
					return PDFToolbox.utils.extractColumnRows(lines, [430, 712, 1200], 5);
				} else if (pagenr < 220) {
					return PDFToolbox.utils.extractColumnRows(lines, [300, 550, 1200], 5);
				} else if (pagenr < 228) {
					return PDFToolbox.utils.extractColumnRows(lines, [300, 580, 1200], 5);
				} else {
					console.log('error');
					return [];//PDFToolbox.utils.extractColumnRows(lines, [200, 300, 1200], 5);
				}
			},
			processRows: function (rows) {
				var filename = path.basename(item.url).replace('.pdf', '');
				var sl = rows.map(function (row) {
					return JSON.stringify(row.map(function (s) {
						return s ? s.trim() : s;
					}));
				});
				fs.writeFileSync(filename + ".rows.json", '[' + sl.join(',\n') + ']');
				return rows;
			},
			saveFinal: function () {
				return false; //nop
			}
		}, function (err, items) {
			if (err) console.log(err);
			cb();
		});
	};
};

var Format2009 = function () {
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
			debug: true,
			skipPage: [],
			pageToLines: function (page) {
				var lines = PDFToolbox.utils.pageToLines(page, 4);
				if (page.pageInfo.num == 1) {
					lines = PDFToolbox.utils.extractLines(lines, ['Euro'], ['-------------'/* take all */]);
				}
				return lines;
			},
			processLines: function (lines) {
				return lines.filter(function (line) {
					if (line.length == 1 &&
						(["Land Steiermark",
							"Bundesministerium für Arbeit, Soziales und Konsumentenschutz",
							"Land Vorarlberg",
							"Land Tirol",
							"AMS",
							"WAFF",
							"Bundesministerium für Unterricht, Kunst und Kultur",
							"Land Niederösterreich",
							"Land Salzburg",
							"Land Oberösterreich"

						].indexOf(line[0].str) >= 0)
					) {
						return false;
					}
					return true;
				});
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

				return PDFToolbox.utils.extractColumnRows(lines, [200, 300, 1200], 5);
			},
			processRows: function (rows) {
				rows.forEach(function (row) {
					if (row.length == 3) {
						row[2] = row[2].replace('-€', '').replace('€', '').trim();
					}
				});
				rows = PDFToolbox.utils.mergeMultiRowsTopToBottom(rows, 2, [0, 1]);
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

var Format2010 = function () {
	// different pdfs mixed into one
	// 1. extract rows, combine by hand

	var _VALUE = PDFToolbox.FIELDS.VALUE1;
	var _TEXT = function (cell) {
		return cell && !_VALUE(cell);
	};
	var rowspecs = [
		[_TEXT, _TEXT, _VALUE],
		[null, _TEXT, _VALUE],
		[null, _TEXT]
	];

	this.scrapePDF = function (item, cb) {
		var pdf = new PDFToolbox();
		pdf.scrape(item.url, {
			debug: true,
			skipPage: [],
			pageToLines: function (page) {
				var lines = PDFToolbox.utils.pageToLines(page, 4);
				if (page.pageInfo.num == 1) {
					lines = PDFToolbox.utils.extractLines(lines, ['Konsumentenschutz'], ['-------------'/* take all */]);
				}
				if (lines.length > 0 && lines[lines.length - 1].length == 1) {
					//skipping page number footer
					lines = lines.slice(0, lines.length - 1);
				}
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
				var filename = path.basename(item.url).replace('.pdf', '');
				var sl = rows.map(function (row) {
					return JSON.stringify(row.map(function (s) {
						return s ? s.trim() : s;
					}));
				});
				fs.writeFileSync(filename + ".rows.json", '[' + sl.join(',\n') + ']');
				return rows;
			},
			saveFinal: function () {
				return false; //nop
			}
		}, function (err, items) {
			if (err) console.log(err);
			cb();
		});
	};
};

var Format2011 = function () {
	// different pdfs mixed into one
	// 1. extract rows, combine by hand

	var _VALUE = PDFToolbox.FIELDS.VALUE1;
	var _TEXT = function (cell) {
		return cell && !_VALUE(cell);
	};
	var rowspecs = [
		[_TEXT, _TEXT, _VALUE],
		[null, _TEXT, _VALUE],
		[null, _TEXT]
	];

	this.scrapePDF = function (item, cb) {
		var pdf = new PDFToolbox();
		pdf.scrape(item.url, {
			debug: true,
			skipPage: [],
			pageToLines: function (page) {
				var lines = PDFToolbox.utils.pageToLines(page, 4);
				if (page.pageInfo.num == 1) {
					lines = PDFToolbox.utils.extractLines(lines, ['Arbeitsmarktservice'], ['-------------'/* take all */]);
				}
				if (lines.length > 0 && lines[lines.length - 1].length == 1 && !isNaN(lines[lines.length - 1][0].str)) {
					//skipping page number footer
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
				rows = rows.filter(function (row) {
					if (row.length == 1) {
						if (["Bundesministerium für Unterricht, Kunst und Kultur",
								"Bundesministerium für Arbeit, Soziales und Konsumentenschutz",
								"Land Kärnten",
								"Land Niederösterreich",
								"Land Oberösterreich",
								"Land Salzburg ",
								"Land Steiermark ",
								"Land Tirol",
								"Land Vorarlberg",
								"Wiener ArbeitnehmerInnen Förderungsfonds (WAFF)"
							].indexOf(row[0].trim()) >= 0) return false;
					}
					return true;
				});
				var filename = path.basename(item.url).replace('.pdf', '');
				fs.writeFileSync(filename + ".manual.json", JSON.stringify(rows, null, '\t'));
				return rows;
			},
			rowToFinal: function (row) {
				return row;
			},
			processFinal: function (items) {
				return items;
			},
			saveFinal: function () {
				return false; //nop
			}
		}, function (err, items) {
			if (err) console.log(err);
			cb();
		});
	};
};

var Format2012 = function () {
	//wow, this one is messy.
	// 1. get horizontal lines & content from pdf2json
	// 2. extract contents between _long_ lines
	// 3. morph to line collection to individual lines (1 beneficiary with multiple entries)
	// 4. fix the broken lines by hand

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
						newrows.forEach(function (newrow) {
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
	// {url: 'http://www.esf.at/esf/wp-content/uploads/Verzeichnis-der-Beg%C3%BCnstigten-2014.pdf', format: Format2014},
	// {url: 'http://www.esf.at/esf/wp-content/uploads/Liste-der-ESF-Beguenstigten-2013.pdf', format: Format2013},
	// {url: 'http://www.esf.at/esf/wp-content/uploads/Liste-der-ESF-Beg%C3%BCnstigten-2012.pdf', format: Format2012},
	// {url: 'http://www.esf.at/esf/wp-content/uploads/20120827_Liste-der-ESF-Beg%C3%BCnstigten-20111.pdf', format: Format2011},
	// {url: 'http://www.esf.at/esf/wp-content/uploads/2010-ESF_Verzeichnis_Beg%C3%BCnstigte_%C3%96sterreich.pdf', format: Format2010}
	// {url: 'http://www.esf.at/esf/wp-content/uploads/2011/02/List-of-Beneficiaries_2009.pdf', format: Format2009},
	// {url: 'http://www.esf.at/esf/wp-content/uploads/ESF-List-of-Beneficiaries-Austria-2007-2008.pdf', format: Format20078}
];

async.forEachSeries(list, scrapeItem, function () {
	console.log('done');
});
