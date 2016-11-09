/*

 Web-Scraper for:
 http://eupalyazatiportal.hu/nyertes_palyazatok/

 */

var scrapyard = require("scrapyard");
var async = require("async");
var fs = require("fs");
var scraper = new scrapyard({
	debug: true,
	retries: 5,
	connections: 10,
	cache: '../../local/cache',
	bestbefore: "600min"
});


var scrapeprogramFund = function (fund, program, next) {
	var list = [];
	if (fund.CONTENT) console.log('-------Fund:', fund.CONTENT);

	var scrapeprogramFundItem = function (id, fund, program, cb) {
		var url = 'http://emir.nfu.hu/nyertes/index.php?node=details&forras=' + program.id + '&id=' + id;
		scraper({
				url: url,
				method: "GET",
				type: "html",
				encoding: "utf-8"
			},
			function (err, $) {
				// console.log('count', list.length, 'queue', queue.length());
				var o = {
					_program: program.name,
					_program_id: program.id,
					_fund: fund.CONTENT ? fund.CONTENT : ''
				};
				$('.datatab tr').each(function (i, elem) {
					$elem = $(elem);
					if ($elem.children().length == 2) {
						var key = '';
						$elem.children().each(function (j, e) {
							if (j == 0) key = $(e).text().replace(':', '').trim();
							else o[key] = $(e).text().trim();
						});
					}
				});
				list.push(o);
				cb();
			});
	};

	var queue = async.queue(function (item, cb) {
		scrapeprogramFundItem(item.id, item.fund, item.program, cb);
	}, 10);
	queue.drain = function () {
		var filename = 'data-' + program.id + (fund.id ? '-' + fund.id : '') + '.json';
		fs.writeFileSync(filename, JSON.stringify(list, null, '\t'));
		console.log(list.length + ' items written');
		next();
	};

	var count = 0;
	var items = [];
	var scrapeFundPage = function (page) {
		scraper({
				url: 'http://emir.nfu.hu/nyertes/?node=list',
				method: "POST",
				type: "json",
				encoding: "utf-8",
				form: {
					_search: false,
					eupik_nev: '',
					forras: program.id,
					forras_uj: fund.id ? fund.id : '',
					id_szerv: 0,
					kiiras_eve: '',
					kitoresi_pont: '',
					nd: 1478692761125,
					op_nev: '',
					op_type: 'op_nev',
					page: page,
					palyazo_nev: '',
					print: 0,
					rows: 100,
					sidx: 'NEV',
					sord: 'asc',
					tkod: '',
					ttipus: ''
				}
			},
			function (err, json) {
				if (!json) {
					return console.log(err, json);
				}
				if (!json || !json.rows) {
					items.forEach(function (item) {
						item.rows.forEach(function (row) {
							var ids = row.cell[0].slice(row.cell[0].indexOf('adatlap(') + 'adatlap('.length);
							id = ids.slice(0, ids.indexOf(');')).split(',')[1];
							queue.push({
								id: id,
								fund: fund,
								program: program
							});
						});
					});

					// var filename = 'data-' + program.id + (fund.id ? '-' + fund.id : '') + '.json';
					// fs.writeFileSync(filename, JSON.stringify(items, null, '\t'));
				} else {
					//http://emir.nfu.hu/nyertes/index.php?node=details&forras=umft&id=119227
					count += json.rows.length;
					// console.log('---', count + '/' + json.records + ' - Page: ' + json.page + '/' + json.total);
					var o = {
						fund: fund,
						program: program,
						rows: json.rows
					};
					items.push(o);
					scrapeFundPage(page + 1)
				}
			});
	};

	scrapeFundPage(1)

};

var scrapeprogramFundCSV = function (fund, program) {
	if (fund.name) console.log('Fund:', fund.name);
	var url = 'http://emir.nfu.hu/nyertes/index.php?node=export' +
		'&forras=' + program.id + (fund.id ? '&forras_uj=' + fund.id : '');
	console.log(url);
	scraper({
			url: url +
			'&palyazo_nev=' +
			'&op_type=op_nev' +
			'&op_nev=' +
			'&ttipus=orszag' +
			'&tkod=0' +
			'&print=0' +
			'&export=1' +
			'&id_szerv=0' +
			'&sort=asc' +
			'&order=NEV' +
			'&page=1' +
			'&rows=10',
			method: "GET",
			type: "raw",
			encoding: "utf-8"
		},
		function (err, csv) {
			console.log(csv);
			var filename = program.id + (fund.id ? '-' + fund.id : '') + '.csv';
			fs.writeFileSync(filename, csv);
		});
};

var scrapeprogram = function (program, next) {
	console.log('---program:', program.name);
	scraper({
			url: 'http://emir.nfu.hu/nyertes/index.php?node=get_select&name=forras_uj&forras=' + program.id,
			method: "GET",
			type: "json",
			encoding: "utf-8"
		},
		function (err, json) {
			if (json.length === 0) json = [''];
			async.forEachSeries(json, function (fund, cb) {
					fund.id = fund.ID;
					// scrapeprogramFundCSV(fund, program);
					scrapeprogramFund(fund, program, cb);
				},
				next
			);
		});
};

var base = [
	{id: '1420', name: 'SZÉCHENYI 2020'},
	{id: 'uszt', name: 'ÚSZT'},
	{id: 'umft', name: 'EU 2007-2013'},
	{id: 'nft', name: 'NFT'}
	// ,
	// {id: 'ktia', name: 'KTIA'}
];

async.forEachSeries(base, scrapeprogram, function () {
	console.log('done');
});
