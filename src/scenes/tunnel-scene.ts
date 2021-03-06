import { vec2, vec3 } from 'gl-matrix';
import {
  CircleLight,
  FilteringOptions,
  InvertedTunnelFactory,
  Renderer,
  renderNoise,
  rgb,
  runAnimation,
  WrapOptions,
} from 'sdf-2d';
import { clamp } from '../helper/clamp';
import { last } from '../helper/last';
import { prettyPrint } from '../helper/pretty-print';
import { Random } from '../helper/random';
import { settings } from '../settings';
import { Scene } from './scene';

const InvertedTunnel = InvertedTunnelFactory(3);

export class TunnelScene implements Scene {
  private overlay: HTMLDivElement;
  private tunnels: Array<InstanceType<typeof InvertedTunnel>> = [];
  private lights: Array<CircleLight> = [];
  public insights?: any;

  private generateTunnel() {
    let previousEnd = vec2.fromValues(0, 0.5);
    let previousRadius = 0.1;

    if (this.tunnels.length > 0) {
      previousEnd = last(this.tunnels).to;
      previousRadius = last(this.tunnels).toRadius;
    }

    let height = previousEnd.y + Random.getRandomInRange(-0.4, 0.4);
    height = clamp(height, 0.2, 0.8);

    const currentEnd = vec2.fromValues(this.tunnels.length * 0.25, height);
    const currentToRadius = Random.getRandom() * 0.1 + 0.1;

    this.tunnels.push(
      new InvertedTunnel(previousEnd, currentEnd, previousRadius, currentToRadius)
    );

    if (this.tunnels.length % 4 == 0) {
      this.lights.push(
        new CircleLight(
          previousEnd,
          vec3.normalize(vec3.create(), [
            Random.getRandom(),
            Random.getRandom(),
            Random.getRandom(),
          ]),
          0.00025
        )
      );
    }
  }

  public async run(canvas: HTMLCanvasElement, overlay: HTMLDivElement): Promise<void> {
    const noiseTexture = await renderNoise([1024, 1], 15, 0.5);

    this.overlay = overlay;

    for (let i = 0; i < 30; i++) {
      this.generateTunnel();
    }

    await runAnimation(
      canvas,
      [
        {
          ...InvertedTunnel.descriptor,
          shaderCombinationSteps: [0, 1, 2, 4, 8, 12],
        },
        {
          ...CircleLight.descriptor,
          shaderCombinationSteps: [0, 1, 2, 3, 4, 5, 6, 7],
        },
      ],
      this.drawNextFrame.bind(this),
      {
        lightPenetrationRatio: 0.5,
        isWorldInverted: true,
        enableHighDpiRendering: true,
        ambientLight: rgb(0.35, 0.1, 0.45),
        colorPalette: [rgb(0.4, 0.5, 0.6), rgb(0, 0, 0), rgb(0, 0, 0), rgb(0, 0, 0)],
        textures: {
          noiseTexture: {
            source: noiseTexture,
            overrides: {
              maxFilter: FilteringOptions.LINEAR,
              wrapS: WrapOptions.MIRRORED_REPEAT,
            },
          },
        },
      }
    );
  }

  private deltaSinceStart = 0;
  private drawNextFrame(
    renderer: Renderer,
    currentTime: DOMHighResTimeStamp,
    deltaTime: DOMHighResTimeStamp
  ): boolean {
    this.insights = renderer.insights;

    this.deltaSinceStart += deltaTime;
    const startX = this.deltaSinceStart / 4 / 1000;
    const width = renderer.canvasSize.x / renderer.canvasSize.y;
    renderer.setViewArea(vec2.fromValues(startX, 1), vec2.fromValues(width, 1));

    this.overlay.innerText = prettyPrint(renderer.insights);

    [
      ...this.tunnels.filter(
        (t) =>
          startX < t.to.x + t.toRadius && t.from.x - t.fromRadius <= startX + width * 1
      ),
      ...this.lights,
    ].forEach((d) => renderer.addDrawable(d));

    return currentTime < settings.sceneTimeInMilliseconds;
  }
}
