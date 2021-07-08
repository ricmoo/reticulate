"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const os_1 = __importDefault(require("os"));
const path_1 = require("path");
const config_1 = require("./config");
const _config = new config_1.Config(path_1.resolve(os_1.default.homedir(), ".reticulaterc"));
exports.config = {
    get: function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield _config.get(key);
        });
    },
    set: function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield _config.set(key, value);
        });
    },
    keys: function () {
        return __awaiter(this, void 0, void 0, function* () {
            return yield _config.keys();
        });
    },
    lock: function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield _config.lock();
        });
    }
};
//# sourceMappingURL=reticulate-config.js.map