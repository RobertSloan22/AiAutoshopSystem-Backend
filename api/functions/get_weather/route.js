var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
export function GET(request) {
    return __awaiter(this, void 0, void 0, function () {
        var searchParams, location_1, unit, geoRes, geoData, _a, lat, lon, weatherRes, weather, now, currentHourISO, index, currentTemperature, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    searchParams = new URL(request.url).searchParams;
                    location_1 = searchParams.get("location");
                    unit = searchParams.get("unit");
                    return [4 /*yield*/, fetch("https://nominatim.openstreetmap.org/search?q=".concat(location_1, "&format=json"))];
                case 1:
                    geoRes = _b.sent();
                    return [4 /*yield*/, geoRes.json()];
                case 2:
                    geoData = _b.sent();
                    if (!geoData.length) {
                        return [2 /*return*/, new Response(JSON.stringify({ error: "Invalid location" }), {
                                status: 404,
                            })];
                    }
                    _a = geoData[0], lat = _a.lat, lon = _a.lon;
                    return [4 /*yield*/, fetch("https://api.open-meteo.com/v1/forecast?latitude=".concat(lat, "&longitude=").concat(lon, "&hourly=temperature_2m&temperature_unit=").concat(unit !== null && unit !== void 0 ? unit : "celsius"))];
                case 3:
                    weatherRes = _b.sent();
                    if (!weatherRes.ok) {
                        throw new Error("Failed to fetch weather data");
                    }
                    return [4 /*yield*/, weatherRes.json()];
                case 4:
                    weather = _b.sent();
                    now = new Date();
                    currentHourISO = now.toISOString().slice(0, 13) + ":00";
                    index = weather.hourly.time.indexOf(currentHourISO);
                    currentTemperature = index !== -1 ? weather.hourly.temperature_2m[index] : null;
                    if (currentTemperature === null) {
                        return [2 /*return*/, new Response(JSON.stringify({ error: "Temperature data unavailable" }), { status: 500 })];
                    }
                    return [2 /*return*/, new Response(JSON.stringify({ temperature: currentTemperature }), {
                            status: 200,
                        })];
                case 5:
                    error_1 = _b.sent();
                    console.error("Error getting weather:", error_1);
                    return [2 /*return*/, new Response(JSON.stringify({ error: "Error getting weather" }), {
                            status: 500,
                        })];
                case 6: return [2 /*return*/];
            }
        });
    });
}
