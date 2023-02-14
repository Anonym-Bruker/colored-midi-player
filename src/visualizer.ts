import * as mm from '@magenta/music/esm/core.js';
import {NoteSequence, INoteSequence} from '@magenta/music/esm/protobuf.js';

import {visualizerTemplate} from './assets';
import {MAX_MIDI_PITCH, MIN_MIDI_PITCH} from "@magenta/music/esm/core/constants.js";

const MIN_NOTE_LENGTH = 1;
const VISUALIZER_TYPES = ['piano-roll-canvas','piano-roll', 'waterfall', 'staff'] as const;
type VisualizerType = typeof VISUALIZER_TYPES[number];
//type Visualizer = mm.PianoRollSVGVisualizer | mm.WaterfallSVGVisualizer | mm.StaffSVGVisualizer;
type Visualizer = mm.PianoRollCanvasVisualizer | mm.PianoRollSVGVisualizer |mm.WaterfallSVGVisualizer | mm.StaffSVGVisualizer;

const GREEN = '9,132,49';
const PURPLE = '138,54,113';
const BROWN = '116,64,6';
const YELLOW = '241,233,0';
const RED = '242,0,0';
const BLUE = '10,88,186';
const ORANGE = '255,142,20';
const BLACK = '0,0,0';

const rgbMap = new Map();
rgbMap.set(55, RED);
rgbMap.set(57, BLUE);
rgbMap.set(59, ORANGE);
rgbMap.set(60, GREEN);
rgbMap.set(62, PURPLE);
rgbMap.set(64, BROWN);
rgbMap.set(65, YELLOW);
rgbMap.set(67, RED);
rgbMap.set(69, BLUE);
rgbMap.set(71, ORANGE);


/**
 * MIDI visualizer element.
 *
 * The visualizer is implemented via SVG elements which support styling as described
 * [here](https://magenta.github.io/magenta-js/music/demos/visualizer.html).
 *
 * See also the
 * [`@magenta/music/core/visualizer` docs](https://magenta.github.io/magenta-js/music/modules/_core_visualizer_.html).
 *
 * @prop src - MIDI file URL
 * @prop type - Visualizer type
 * @prop noteSequence - Magenta note sequence object representing the currently displayed content
 * @prop config - Magenta visualizer config object
 */
export class VisualizerElement extends HTMLElement {
  private domInitialized = false;
  private initTimeout: number;

  protected wrapper: HTMLDivElement;
  protected visualizer: Visualizer;
  protected ctx: CanvasRenderingContext2D;
  protected sequenceIsQuantized: boolean;


  protected ns: INoteSequence = null;
  protected _config: mm.VisualizerConfig = {};
  protected _configStaff: mm.StaffSVGVisualizerConfig = {};
  protected _configWater: mm.WaterfallVisualizerConfig = {};
  protected height: number;
  protected width: number;

  static get observedAttributes() { return ['src', 'type']; }

  connectedCallback() {
    this.attachShadow({mode: 'open'});
    this.shadowRoot.appendChild(visualizerTemplate.content.cloneNode(true));

    if (this.domInitialized) {
      return;
    }
    this.domInitialized = true;

    this.wrapper = document.createElement('div');
    this.appendChild(this.wrapper);

    this.initVisualizerNow();
  }

  attributeChangedCallback(name: string, _oldValue: string, _newValue: string) {
    if (name === 'src' || name === 'type') {
      this.initVisualizer();
    }
  }

  protected initVisualizer() {
    if (this.initTimeout == null) {
      this.initTimeout = window.setTimeout(() => this.initVisualizerNow());
    }
  }

  protected async initVisualizerNow() {
    this.initTimeout = null;
    if (!this.domInitialized) {
      return;
    }
    if (this.src) {
      this.ns = null;
      this.ns = await mm.urlToNoteSequence(this.src);
    }

    this.wrapper.innerHTML = '';

    if (!this.ns) {
      return;
    }
    const size = this.getSize();
    this.width = size.width;
    this.height = size.height;

    if (this.type === 'piano-roll-canvas') {
      this.wrapper.classList.add('piano-roll-visualizer');
      const canvas = document.createElement('canvas');
      this.wrapper.appendChild(canvas);
      this.visualizer = new mm.PianoRollCanvasVisualizer(this.ns, canvas, this._config);
      const div = document.createElement('div');
      const midilabel = document.createElement('label');
      midilabel.setAttribute("name", "midifileName");
      midilabel.id = "midifileId";
      div.appendChild(midilabel);
      this.wrapper.appendChild(div);
      this.ctx = canvas.getContext('2d');
      document.getElementById("midifileId").innerText = "Intializing....(Paused)";
    } else if (this.type === 'piano-roll') {
      this.wrapper.classList.add('piano-roll-visualizer');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.wrapper.appendChild(svg);
      this.visualizer = new mm.PianoRollSVGVisualizer(this.ns, svg, this._config);
      const div = document.createElement('div');
      const midilabel = document.createElement('label');
      midilabel.setAttribute("name", "midifileName");
      midilabel.id = "midifileId";
      div.appendChild(midilabel);
      this.wrapper.appendChild(div);
      document.getElementById("midifileId").innerText = "Intializing....(Paused)";
    } else if (this.type === 'waterfall') {
      this.wrapper.classList.add('waterfall-visualizer');
      this.visualizer = new mm.WaterfallSVGVisualizer(this.ns, this.wrapper, this._config);
    } else if (this.type === 'staff') {
      this.wrapper.classList.add('staff-visualizer');
      const div = document.createElement('div');
      this.wrapper.appendChild(div);
      this.visualizer = new mm.StaffSVGVisualizer(this.ns, div, this._config);
    }
  }

  reload() {
    this.initVisualizerNow();
  }

  async redraw(activeNote?: NoteSequence.INote) {
    if (this.visualizer) {
      let rgb = GREEN;
      if( rgbMap.has(activeNote.pitch)){
        rgb = rgbMap.get(activeNote.pitch);
      }
      if(this.type === 'staff'){
        this._configStaff = {
          noteHeight: 15,
          activeNoteRGB: rgb,
          scrollType: 1
        };
        this._config = this._configStaff;
      } else if(this.type === 'waterfall'){
        this._configWater = {
          activeNoteRGB: rgb,
          whiteNoteHeight: 100,
          whiteNoteWidth: 35,
          pixelsPerTimeStep: 60

        };
        this._config = this._configWater;
      } else {
        this._config = {
          noteHeight: 50,
          activeNoteRGB: rgb
        };
      }

      const promise = this.initVisualizerNow();
      await promise;
      if(this.visualizer instanceof mm.PianoRollCanvasVisualizer){
        for (let i = 0; i < this.noteSequence.notes.length; i++) {
          const note = this.noteSequence.notes[i];
          const size = this.getNotePosition(note);
          //const opacityBaseline = 0.2;
          //const opacity = note.velocity ? note.velocity / 100 + opacityBaseline : 1;
          let noteRGB = BLACK;
          const fill = `rgb(${noteRGB})`;
          this.ctx.fillStyle = fill;
          this.ctx.fillRect(Math.round(size.x), Math.round(size.y)+30, Math.round(size.w), Math.round(size.h));
        }
      }
      let position = this.visualizer.redraw(activeNote, activeNote != null);
      //logging.log(' Drawing complete ', 'mm.Visualizer', 10);
      const fill = `rgb(${YELLOW})`;
      this.ctx.fillStyle = fill;
      this.ctx.fillRect(10, 10, 10,10);
      document.getElementById("midifileId").innerText = "Pitch value: " + activeNote.pitch + ", pos: " + position + ", Notes: " + this.noteSequence.notes.length;
    }
  }

  clearActiveNotes() {
    if (this.visualizer) {
      this.visualizer.clearActiveNotes();
    }
  }

  getNotePosition(note: NoteSequence.INote) {
    const duration = this.getNoteEndTime(note) - this.getNoteStartTime(note);
    const x = (this.getNoteStartTime(note) * this.config.pixelsPerTimeStep);
    const w = Math.max(this.config.pixelsPerTimeStep * duration - this.config.noteSpacing, MIN_NOTE_LENGTH);
    const y = this.height -
        ((note.pitch - this.config.minPitch) * this.config.noteHeight);
    return { x, y, w, h: this.config.noteHeight };
  }
  updateMinMaxPitches(noExtraPadding = false) {
    if (this._config.minPitch && this._config.maxPitch) {
      return;
    }
    if (this._config.minPitch == undefined) {
      this._config.minPitch = MAX_MIDI_PITCH;
    }
    if (this._config.maxPitch == undefined) {
      this._config.maxPitch = MIN_MIDI_PITCH;
    }
    for (const note of this.noteSequence.notes) {
      this._config.minPitch = Math.min(note.pitch, this._config.minPitch);
      this._config.maxPitch = Math.max(note.pitch, this._config.maxPitch);
    }
    if (!noExtraPadding) {
      this._config.minPitch -= 2;
      this._config.maxPitch += 2;
    }
  }

  getSize() {
    //this.updateMinMaxPitches();
    const height = (this._config.maxPitch - this._config.minPitch) * this._config.noteHeight;
    const endTime = this.sequenceIsQuantized ? this.noteSequence.totalQuantizedSteps : this.noteSequence.totalTime;
    if (!endTime) {
      throw new Error('The sequence you are using with the visualizer does not have a ' +
          (this.sequenceIsQuantized ? 'totalQuantizedSteps' : 'totalTime') +
          ' field set, so the visualizer can\'t be horizontally ' +
          'sized correctly.');
    }
    const width = (endTime * this._config.pixelsPerTimeStep);
    return { width, height };
  }

  getNoteStartTime(note: NoteSequence.INote) {
    return this.sequenceIsQuantized ?
        note.quantizedStartStep :
        Math.round(note.startTime * 100000000) / 100000000;
  }
  getNoteEndTime(note: NoteSequence.INote) {
    return this.sequenceIsQuantized ?
        note.quantizedEndStep :
        Math.round(note.endTime * 100000000) / 100000000;
  }

  get noteSequence() {
    return this.ns;
  }

  set noteSequence(value: INoteSequence | null) {
    if (this.ns == value) {
      return;
    }
    this.ns = value;
    this.removeAttribute('src');  // Triggers initVisualizer only if src was present.
    this.initVisualizer();
  }

  get src() {
    return this.getAttribute('src');
  }

  set src(value: string | null) {
    this.ns = null;
    this.setOrRemoveAttribute('src', value);  // Triggers initVisualizer only if src was present.
    this.initVisualizer();
  }

  get type() {
    let value = this.getAttribute('type');
    if ((VISUALIZER_TYPES as readonly string[]).indexOf(value) < 0) {
      value = 'piano-roll';
    }
    return value as VisualizerType;
  }

  set type(value: VisualizerType) {
    if (value != null && VISUALIZER_TYPES.indexOf(value) < 0) {
      throw new Error(
        `Unknown visualizer type ${value}. Allowed values: ${VISUALIZER_TYPES.join(', ')}`);
    }
    this.setOrRemoveAttribute('type', value);
  }

  get config() {
    return this._config;
  }

  set config(value: mm.VisualizerConfig) {
    this._config = value;
    this.initVisualizer();
  }

  protected setOrRemoveAttribute(name: string, value: string) {
    if (value == null) {
      this.removeAttribute(name);
    } else {
      this.setAttribute(name, value);
    }
  }
}
