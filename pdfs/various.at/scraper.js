/*


 Austria. One scraper for the following six files:

 https://www.salzburg.gv.at/wirtschaft_/Documents/rwf-beguenstigte.pdf

 https://www.vorarlberg.at/pdf/verzeichnisderbeguenstigt.pdf

 http://www.regio13.at/redx/tools/mb_download.php/mid.x596b672f63676a5359416f3d/Verzeichnis.pdf

 http://www.innovation-steiermark.at/de/projekte/verzeichnis/Beguenstigte_25.08.15_R57.pdf

 http://kwf.at/downloads/deutsch/EU/Publizitaet_Kaernten.pdf

 http://www.raumordnung-noe.at/fileadmin/root_raumordnung/land/eu_regionalpolitik/RWB_Niederoesterreich.pdf

 */

var scrapyard = require("scrapyard");
var async = require("async");
var path = require("path");
var request = require("request");
var fs = require("fs");
var parser = require('./parser.js');

var scrapePDF = function (item, next) {
	var filename = path.basename(item).replace('.pdf', '');
	console.log('scraping pdf', filename);
	parser.parse(filename + '.pdf', function (err, items) {
		items = items.map(function (i) {
			return {
				_source: item,
				beneficiary: i.col1,
				name_of_the_operation: i.col2,
				allocated_public_funding: i.val1,
				status: (i.val2 == 'G' ? 'commited' : (i.val2 == 'A' ? 'paid out' : i.val2))
			};
		});
		fs.writeFileSync(filename + ".json", JSON.stringify(items, null, '\t'));
		next();
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
	'https://www.salzburg.gv.at/wirtschaft_/Documents/rwf-beguenstigte.pdf',
	'https://www.vorarlberg.at/pdf/verzeichnisderbeguenstigt.pdf',
	'http://www.regio13.at/redx/tools/mb_download.php/mid.x596b672f63676a5359416f3d/Verzeichnis.pdf',
	'http://www.innovation-steiermark.at/de/projekte/verzeichnis/Beguenstigte_25.08.15_R57.pdf',
	'http://kwf.at/downloads/deutsch/EU/Publizitaet_Kaernten.pdf',
	'http://www.raumordnung-noe.at/fileadmin/root_raumordnung/land/eu_regionalpolitik/RWB_Niederoesterreich.pdf'
];

async.forEachSeries(list, scrapeItem, function () {
	console.log('done');
});
