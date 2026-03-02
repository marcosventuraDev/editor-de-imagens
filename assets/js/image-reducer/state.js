// /assets/js/image-reducer/state.js
import { createHistory } from "./history.js";

export function createState() {
  return {
    objectUrls: new Set(),
    isCropping: false,
    _cropper: null,
    _cropTxn: null,          //  txn do crop
    history: createHistory(30)
  };
}