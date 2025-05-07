/*
   Copyright (c) 2024 Oliver Lau, oliver@ersatzworld.net
*/

(function (window) {
    "use strict";

    const AnimationDurationMs = 451 * Math.SQRT2;

    let allLamps = [];
    let running = true;
    let opacity = null; // will be set to WASM function in loadWASM()
    let mt = {};

    function markBrightestLamps(selector, n) {
        let brighestLamps = [];
        for (const field of document.querySelectorAll(selector)) {
            let maxOpacity = Number.MIN_VALUE;
            let brightestLamp = null;
            for (const lamp of field.querySelectorAll('.lamp')) {
                const opacity = parseFloat(lamp.style.opacity);
                if (opacity > maxOpacity) {
                    brightestLamp = lamp;
                    maxOpacity = opacity;
                }
            }
            brighestLamps.push({
                opacity: maxOpacity,
                el: brightestLamp,
            });
            brightestLamp.classList.add('marked');
        }
        brighestLamps.sort((a, b) => {
            return b.opacity - a.opacity;
        });
        brighestLamps.slice(0, n).forEach(lamp => {
            lamp.el.parentElement.querySelector('.number').classList.add('visible');
        });
    };

    function measure(e) {
        running = false;
        markBrightestLamps('#ticket .left .field', 5);
        markBrightestLamps('#ticket .right .field', 2);
        e.target.setAttribute('disabled', true);
        e.target.style.cursor = 'not-allowed';
        e.target.removeEventListener('click', measure);
    }

    function buildTicketPart(side, n) {
        const part = document.querySelector(`#ticket .${side}`);
        for (let i = 0; i < n; ++i) {
            const field = document.createElement('span');
            field.className = 'field';
            const number = document.createElement('span');
            number.textContent = `${i + 1}`;
            number.className = 'number';
            field.append(number);
            for (let j = 0; j < n; ++j) {
                const lamp = document.createElement('span');
                lamp.className = 'lamp';
                field.append(lamp);
                allLamps.push({
                    el: lamp,
                    offset: mt.randint() % AnimationDurationMs,
                    animationDuration: AnimationDurationMs - 200 / n * (mt.randint() % (j + 1)),
                });
            }
            part.append(field);
        }
    }

    function update(t) {
        if (!running)
            return;
        allLamps.forEach(lamp => {
            lamp.el.style.opacity = opacity(lamp.offset, t, lamp.animationDuration);
        });
        window.requestAnimationFrame(update);
    }

    async function init(wasmInstance) {
        const { exports } = wasmInstance;
        opacity = exports.opacity;
        mt.seed = exports.init_genrand;
        mt.seedseq = exports.init_by_array;
        mt.randint = exports.genrand_int31;

        const BUFSIZE = exports.n();
        const memory = exports.memory;
        const memView = new Uint32Array(memory.buffer);
        const seeds = new Uint32Array(BUFSIZE);
        crypto.getRandomValues(seeds);
        seeds.forEach((val, idx) => memView[idx] = val);
        mt.seedseq(memView.byteOffset, BUFSIZE);

        buildTicketPart("left", 50);
        buildTicketPart("right", 12);
    }

    function run() {
        window.requestAnimationFrame(update);
    }

    async function loadWASM() {
        let instance;
        try {
            instance = (await WebAssembly.instantiateStreaming(fetch('MT/mt.wasm'))).instance;
        }
        catch (e) {
            return Promise.reject(e);
        }
        return instance;
    }

    function main() {
        document.querySelector('#measure-button')
            .addEventListener('click', measure);
        loadWASM()
            .then(init)
            .then(run)
            .catch(e => console.error(e));
    }

    window.addEventListener('load', main);

})(window);
