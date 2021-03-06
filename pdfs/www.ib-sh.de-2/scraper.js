/*

 ESF Data Schleswig Holstein 2007-2013
 Download link: http://www.ib-sh.de/fileadmin/user_upload/downloads/Arbeit_Bildung/ZP_Arbeit/allgemein/vdb.pdf
 Startseite: http://www.ib-sh.de/die-ibsh/foerderprogramme-des-landes/landesprogramm-arbeit/
 */

var scrapyard = require("scrapyard");
var async = require("async");
var path = require("path");
var request = require("request");
var fs = require("fs");
var PDFToolbox = require('../../lib/pdftoolbox');

var _VALUE = PDFToolbox.FIELDS.VALUE1;
var _YEAR = PDFToolbox.FIELDS.YEAR;
var _TEXT = function (cell) {
	return cell && !_VALUE(cell) && !_YEAR(cell);
};
var rowspecs = [
	[_TEXT, _TEXT, _YEAR, _VALUE, null],
	[_TEXT, _TEXT, _YEAR, null, _VALUE]
];

var mergeMultiLinesToRows = function (lines) {

	var getY = function (line) {
		for (var i = 0; i < line.length; i++) {
			if (line[i]) return line[i].y;
		}
		return -1;
	};

	var result = [];
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		if (line.length == 0) {
			//this line is done
		} else if (line.length > 3) {
			//use the middle lines with a year to find multiline before & after
			var y = getY(line);
			var group_lines = [];
			var ydown = y;
			for (var j = i - 1; j >= 0; j--) {
				var linedown = lines[j];
				if ((linedown.length === 5) || (linedown.length === 0)) {
					break;
				} else {
					var ybefore = getY(linedown);
					var diff = ydown - ybefore;
					if (diff < 15) {
						lines[j] = [];
						group_lines.unshift(linedown);
					} else {
						break;
					}
					ydown = ybefore;
				}
			}
			group_lines.push(line);
			var yup = y;
			for (var j = i + 1; j < lines.length; j++) {
				var lineup = lines[j];
				if ((lineup.length === 5) || (lineup.length === 0)) {
					break;
				} else {
					var yafter = getY(lineup);
					var diff = yafter - yup;
					if (diff < 15) {
						lines[j] = [];
						group_lines.push(lineup);
					} else {
						break;
					}
					yup = yafter;
				}
			}
			var newline = [null, null, null, null, null];
			group_lines.forEach(function (gline) {
				for (var j = 0; j < newline.length; j++) {
					if (gline[j]) {
						if (!newline[j]) newline[j] = gline[j].str;
						else newline[j] = newline[j] + '\n' + gline[j].str;
					}
				}
			});
			lines[i] = [];
			result.push(newline);
		}
	}
	lines.forEach(function (line) {
		if (line.length > 0) {
			if (line[0] &&
				((line[0].str.indexOf('1) In diesem Betrag enthalten') == 0) || (line[0].str.indexOf('2) Der ausgezahlte Betrag wird') == 0))
			) {
				//ignore doc footer
			} else {
				console.log('warn lost line', line.length, JSON.stringify(line));
			}
		}
	});
	return result;
};

var scrapePDF = function (item, cb) {
	var pdf = new PDFToolbox();
	pdf.scrape(item, {
		skipPage: [],
		pageToLines: function (page) {
			var lines = PDFToolbox.utils.pageToLines(page, 4);
			return PDFToolbox.utils.extractLines(lines, ['Restzahlung'], ['Seite ']);
		},
		processLines: function (lines) {
			return lines;
		},
		pageLinesToRows: function (lines) {
			/*

			 0-150 col 1
			 NAME DES/DER BEGÜNSTIGSTEN

			 150-300 col 2
			 BEZEICHNUNG DES VORHABENS

			 300-390 col 3
			 JAHR DER BEWILLIGUNG / RESTZAHLUNG

			 390-480 col 4
			 GEWÄHRTE BETRÄGE

			 480-
			 BEI ABSCHLUSS DES VORHABENS GEZAHLTE GESAMTBETRÄGE

			 */
			// console.log(PDFToolbox.utils.xStats(page));

			lines = PDFToolbox.utils.extractColumnLines(lines, [250, 520, 590, 750, 1000], 0.12);
			return mergeMultiLinesToRows(lines).filter(function (row) {
					if (!PDFToolbox.utils.isValidRow(row, rowspecs)) {
						console.log('ALARM, invalid row', JSON.stringify(row));
						return false;
					} else {
						return true;
					}
				}
			);
		},
		processRows: function (rows) {
			return rows;
		},
		rowToFinal: function (row) {
			return {
				_source: item,
				beneficiary: row[0] || '',
				name_of_operation: row[1] || '',
				years: row[2] || '',
				allocated_public_funding: row[3] || '',
				on_finish_total_value: row[4] || ''
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

var scrapeItem = function (item, next) {
	console.log('scraping pdf', item);
	var filename = path.basename(item);
	if (!fs.existsSync(filename)) {
		console.log('scraping doc', item);
		var req = request(item);
		var stream = req.pipe(fs.createWriteStream(filename));
		stream.on('close', function () {
			scrapePDF(item, next);
		});
	} else {
		scrapePDF(item, next);
	}
};

var list = [
	'http://www.ib-sh.de/fileadmin/user_upload/downloads/Arbeit_Bildung/ZP_Arbeit/allgemein/vdb.pdf'
];

async.forEachSeries(list, scrapeItem, function () {
	console.log('done');
});
