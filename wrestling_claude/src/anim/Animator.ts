import {applyDoubleBarDefender,applyArmBarEffort,applyArmBarResistance,applyArmBarTurnSteps,isArmBarPin} from './armBarEffort';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import {backGableGrip,gableGrip,palmGrip} from './gableGrip';
import type { CharacterRig } from '../body/Character';
import { BONE_DEF, type BoneName } from '../body/skeleton';
import { Solver } from './solver';
import { blendPosture, createPosture, FOOT, P, PostureSpring } from './posture';
import type { Posture } from './posture';
import { createLocal, localToWorld, mirrorLocal } from './spec';
import type { Frame, LocalPose } from './spec';
import { DEFAULT_STANCE, downBlock, scaleLocal, stancePose } from './stance';
import type { StanceParams } from './stance';
import { Footwork } from './footwork';
import { moveClip, sampleHold, sampleMove, sampleFootContacts } from './clips';
import type { ActiveContact, Role } from './clips';
import { sampleSolo } from './solo';
import { applyChop, applyRideEffort, CHOP, chopCurve } from './matEffort';
import { applyLegEffort } from './legEffort';
import { EffortPulse, effortEnvelope } from './effortPulse';
import type { EffortResult } from './effortPulse';

/**
 * One body's animation.
 *
 * Every frame the animator builds a target posture from what the simulation
 * says this wrestler is doing, chases it with a critically damped spring so
 * changes of state flow instead of snapping, plants the feet, solves the IK and
 * finally closes any grips onto the other body. Nothing here decides anything:
 * it only shows what the bout already decided.
 */

export type AnimView =
  | {
      mode: 'stance';
      x: number;
      z: number;
      yaw: number;
      vx: number;
      vz: number;
      level: number;
      lean: number;
      lead: 1 | -1;
      act: string;
      attemptedTechnique?: string;
      actT: number;
      actDur: number;
      /** My hand-fight control and his, 0..1. */
      hand: number;
      oppHand: number;
      /** Which tie he holds once hand >= 0.62. */
      tie?: 'collar' | 'underhook' | 'bodyLock';
      oppTie?: 'collar' | 'underhook' | 'bodyLock';
      stamina: number;
      exertion: number;
      /** Hands relaxed and standing tall (between whistles). */
      relaxed?: boolean;
      /** Shaking hands with the opponent before the bout. */
      shake?: boolean;
    }
  | {
      mode: 'paired';
      clip: string;
      hold: boolean;
      role: Role;
      frame: Frame;
      mirror: boolean;
      /** Normalised time for moves. */
      u: number;
      /** Progress along a hold's axis. */
      progress: number;
      intensity: number;
      /** Actual defensive grip-fighting progress in a held cradle. */
      resistance?: number;
      pockets?: number;
      /** Bottom man's hand control on the ride (HANDS), 0..1. */
      hands?: number;
      /** Real root distance at the start of a shot, for warping. */
      dist?: number;
      stamina: number;
      exertion: number;
    }
  | {
      mode: 'solo';
      clip: string;
      x: number;
      z: number;
      yaw: number;
      /** Normalised clip time (wraps for loops). */
      u: number;
      stamina: number;
      exertion: number;
      mirror?: boolean;
      /** Hold a bone of the other body (the official raising a hand). */
      grip?: { hand: 'L' | 'R'; on: BoneName; at: [number, number, number] };
    }
  | {
      mode: 'walk';
      x: number;
      z: number;
      yaw: number;
      vx: number;
      vz: number;
      stamina: number;
      exertion: number;
    };

const _m = new Matrix4();
const _v = new Vector3();
const _v2 = new Vector3();

const LEG_BATTLE_CLIPS = new Set(['legsSingle', 'legsDouble', 'legsHighCrotch', 'legsLowSingle']);

export class Animator {
  readonly solver: Solver;
  private spring = new PostureSpring();
  private target: Posture = createPosture();
  private display: Posture = createPosture();
  private local: LocalPose = createLocal();
  private feetDesired: Posture = createPosture();
  private recoveryStart: Posture | null = null;
  private legFinishStart: Posture | null = null;
  private legFinishBlendEnd = 0;
  private legFinishTarget = createPosture();
  private seatedKneeContinuity = false;
  private proneKneeContinuity = false;
  private stanceExit = 0;
  private prevWasStance = false;
  private moveElbowCarry = 0;
  private exposedElbowCarry = 0;
  private barElbowContinuity = false;
  private barGuideWeight=0;
  private barGuideHand:'L'|'R'='L';
  readonly footwork = new Footwork();
  private footW = 0;
  private walkingOverlay = 0;
  private walkingStride = 0;
  /** 0..1: how spent the walk looks (hands on hips, head down), from the view's stamina. */
  private walkTired = 0;
  /** 0..1: how much the walk has become a run. */
  private walkRun = 0;
  /** Leg battles: hips travel (for leading the steps) and which feet may step. */
  private legPrevX = NaN;
  private legPrevZ = NaN;
  private legVx = 0;
  private legVz = 0;
  private legFree: [number, number] = [1, 1];
  /** Seconds left of getting up off the mat into a walk: a slower blend than a step. */
  private riseT = 0;
  private gazeTarget = new Vector3();
  private phase = Math.random() * 10;
  private breath = Math.random() * 6;
  private contacts: ActiveContact[] = [];
  private footContacts: ReturnType<typeof sampleFootContacts> = [];
  private gripW = { L: 0, R: 0 }; private authoredGripWant = {L:0,R:0}; private palmDelta = {L:null as Quaternion|null,R:null as Quaternion|null};
  private handoff = {
    L: {bone:null as BoneName|null,valid:false,age:1,acquiring:false,start:new Vector3(),rotation:new Quaternion(),last:new Vector3(),lastRotation:new Quaternion()},
    R: {bone:null as BoneName|null,valid:false,age:1,acquiring:false,start:new Vector3(),rotation:new Quaternion(),last:new Vector3(),lastRotation:new Quaternion()}
  };
  private cradleClaspLocked=false;
  /** 0..1: hands easing into the cradle lock point once it locks (it used to jump there in one frame). */
  private cradleClaspBlend=0;
  private gripTransfer: {age:number; near:'L'|'R'|null; duration:number; anchors:Record<'L'|'R',{bone:BoneName;at:Vector3}>}|null=null;
  private legReleaseAge=1.2;
  private legReleaseStart: Posture | null=null;
  private gripRelease = {
    L: { age: 1, wrist: new Vector3(), rotation: new Quaternion() },
    R: { age: 1, wrist: new Vector3(), rotation: new Quaternion() },
  };
  private gripBone: { L: BoneName | null; R: BoneName | null } = { L: null, R: null };
  private gripAt = { L: new Vector3(), R: new Vector3() };
  private gripPalm = { L: false, R: false };
  private lastMode = '';
  private handFightAnchor = {
    L: {bone: null as BoneName | null, at: new Vector3(), from: new Vector3(), last: new Vector3(), age: 1, dur: .2},
    R: {bone: null as BoneName | null, at: new Vector3(), from: new Vector3(), last: new Vector3(), age: 1, dur: .2},
  };
  private gaitRotation = new Quaternion();
  private gaitYaw = new Quaternion();
  private gaitAxis = new Vector3(0, 1, 0);
  private lastClipU = 0;
  private contactAcquireRate = 16;
  private contactReleaseRate = 10;
  private halfLife = 0.08;
  private time = 0;
  private previousLegPose=createPosture();
  private legPathPose=createPosture();
  private legPathReady=false;
  private effortPulse = new EffortPulse();
  /** A consumed effort has a physical attempt even when it cannot advance control. */
  effort(button: string, reaction = false, result: EffortResult = 'ok', force = false): void {
    this.effortPulse.trigger(button, reaction, result, force);
  }
  private frameDt = 1 / 60;
  private recoveryClockRate=1;
 private previousRecoveryTarget=createPosture();
 private sampledRecoveryTarget=createPosture();
  private handoffWantStart={L:0,R:0};
 private phaseContactStart={L:0,R:0};
  private handoffDelta:{L:Quaternion|null,R:Quaternion|null}={L:null,R:null};
  /** Hand-fight jitter seeds. */
  private seed = Math.random() * 100;
  /** Free-hand recovery starts at the released front-headlock grip. */
  private fhlPeelRelease: {hand: 'L'|'R'; start: Vector3; age: number}|null = null;
  /** Skip the blend on the next update (cuts, tools). */
  instant = false;

  constructor(readonly character: CharacterRig) {
    this.solver = new Solver(character);
  }

  get scale(): number {
    return this.character.scale;
  }

  /** World position of a bone, after the last solve. */
  bonePos(name: BoneName, out: Vector3): Vector3 {
    return this.character.bones[name].getWorldPosition(out);
  }

  /** Head position for look-at targets. */
  headPos(out: Vector3): Vector3 {
    this.character.bones.head.updateWorldMatrix(true, false);
    return out.set(0, 0.09 * this.scale, 0.05 * this.scale).applyMatrix4(this.character.bones.head.matrixWorld);
  }

  /* --------------------------------------------------------------- update */

  update(dt: number, view: AnimView, opp: Animator | null): void {
    // On the feet the hands reach across for wrists, ties and taps right at the end of the arm, where a
    // straight arm and a bent one are a centimetre apart and the elbow snapped between them (forearm pops
    // with the hand moving slowly). Ease the reach in the last stretch so the arm never locks straight.
    this.solver.softFreeReach.L=this.solver.softFreeReach.R=view.mode==='stance'?1:0;
    this.solver.minReach=view.mode==='stance'?0.22:0;
    if(view.mode==='paired' && view.role==='A' && view.clip==='armBarSupportedSeatedTurnDraft'){
      const ease=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
      this.solver.softFreeReach[view.mirror?'L':'R']=ease((view.u-.52)/.08)*(1-ease((view.u-.80)/.06));
    }
    this.solver.continuousPost=view.mode==='paired' && ['armBarSupportedSeatedTurnDraft','armBarSupportedSeatedFinishDraft','armBarSupportedSeatedFallDraft','armBarSupportedSeatedExitDraft'].includes(view.clip); this.solver.authoredPostDirection.L=null;this.solver.authoredPostDirection.R=null;
 if(view.mode==='paired' && view.role==='A' && ['armBarSupportedSeatedTurnDraft','armBarSupportedSeatedFinishDraft','armBarSupportedSeatedFallDraft','armBarSupportedSeatedExitDraft'].includes(view.clip)){
  // Fingers point forward and slightly out from the sit-through, independent of near-vertical shoulder reach.
  const side=view.mirror?'L':'R';
  this.solver.authoredPostDirection[side]=new Vector3(view.mirror?-.35:.35,0,1).normalize().applyAxisAngle(new Vector3(0,1,0),view.frame.yaw);
 }
 if(view.mode==='paired'&&view.role==='A'&&view.clip==='armBarSupportedSeatedExitDraft'&&view.u<.52){
  this.solver.authoredPostDirection[view.mirror?'R':'L']=new Vector3(view.mirror?1:-1,0,0).applyAxisAngle(new Vector3(0,1,0),view.frame.yaw);
 }
 this.time += dt; this.solver.authoredPalmRelease=view.mode==='paired' && ['armBarSupportedSeatedTurnDraft','armBarSupportedSeatedFinishDraft','armBarSupportedSeatedFallDraft','armBarSupportedSeatedExitDraft'].includes(view.clip) && view.role==='A';
    this.legReleaseAge+=dt;
    const bottomRise = view.mode === 'paired' && view.clip === 'ride'
      && (view.role === 'B' ? !this.effortPulse.reaction : this.effortPulse.reaction)
      && this.effortPulse.button === 'shoot' && this.effortPulse.result === 'lost';
    this.effortPulse.advance(dt, bottomRise ? .65 : .42);
    this.frameDt = dt;
    const jointClock=view.mode==='paired'&&!view.hold&&view.clip==='armBarSupportedSeatedExitDraft'&&this.lastMode==='pairedarmBarSupportedSeatedExitDraft'&&dt>0?Math.max(.05,(view.u-this.lastClipU)/dt)*.85:1;
    const seatedSequence = view.mode==='paired' && ['sitAndCircleLegDefense','seatedLegDefense','seatedLegDefenseExit','recoverSeatedLegDefense','seatedDefenseRecovered','legRide','catchRidingLeg'].includes(view.clip);
    // Keep the solved bend plane when settling back into the ordinary ride.
    // Dropping continuity on that boundary flips a deeply folded knee in one
    // frame; ordinary rides that never entered this sequence stay unchanged.
    if(seatedSequence)this.seatedKneeContinuity=true;
    else if(view.mode!=='paired'||view.clip!=='ride')this.seatedKneeContinuity=false;
    const proneCatch = view.mode==='paired' && (['catchRidingLegFlat','legRideFlatCatchSetup','legRideFlat','legRidePressure','flatGroundedDraft','flatPressureDraft'].includes(view.clip)||/^(armBar|wristBar|barHalf|doubleBar)/.test(view.clip));
    if(proneCatch)this.proneKneeContinuity=true;
    else if(view.mode!=='paired'||view.clip!=='flat')this.proneKneeContinuity=false;
    const flatSupportDraft=view.mode==='paired'&&['armBarSupportedResistedDraft','armBarSupportedSeatedTurnDraft','flatGroundedDraft','flatPressureDraft','armBarPressureSeatedExitDraft','armBarSupportedSeatedExitDraft'].includes(view.clip);
    // A move can swing a folded knee across the leg faster than any body could,
    // so rate-limit the bend on the mat and in stance. Excluded: finishSingle, whose
    // foot passes through the hip, where a limit makes it worse; shotLowSingle, whose
    // deep lunge presses the knee to the mat; spladles, whose knees carry a grip.
    // Solo poses too: rising off the mat into the celebration swung the knees across the leg in one frame.
    const freeBend=(view.mode!=='paired'&&view.mode!=='stance'&&view.mode!=='walk'&&view.mode!=='solo')||this.instant||(view.mode==='paired'&&(view.clip==='finishSingle'||view.clip==='shotLowSingle'||/spladle/i.test(view.clip)));
    const kneeRate=this.proneKneeContinuity?4:this.seatedKneeContinuity?5:freeBend?Infinity:6;
    // Leg rides, seated leg defense and the flat drafts hold their knees on the mat: keep the ground correction whole.
    const groundRate=this.proneKneeContinuity||this.seatedKneeContinuity||seatedSequence||proneCatch||flatSupportDraft?Infinity:kneeRate;
    this.solver.beginKneeFrame(dt*jointClock,kneeRate,flatSupportDraft?(view.mode==='paired'&&view.clip==='armBarSupportedSeatedExitDraft'?.06:.07):.04,groundRate);
    if(view.mode==='paired'&&/^(armBar|wristBar|barHalf|doubleBar)/.test(view.clip))this.barElbowContinuity=true;
    else if(view.mode!=='paired'||!['flat','flatPressureDraft'].includes(view.clip))this.barElbowContinuity=false;
    // Coming off the back, the arm settles for a moment before flat's own hand work.
    this.exposedElbowCarry=view.mode==='paired'&&(view.clip==='exposed'||view.clip==='fightOff')?.6:Math.max(0,this.exposedElbowCarry-dt);
    // Carry the solved bend into the flat ride after a bar clears. Dropping
    // continuity at that boundary can flip the elbow in a single frame.
    // A move limits how fast an elbow can swing; a hold does not. Keep the move's limit for a
    // moment after it hands off to its hold, or the elbow finishes any held-back swing in one
    // frame (the "jump at the hand-off": double finish into the ride, breakdown into flat...).
    // A hold that switches straight to another hold (a high crotch run to the double, say) changes every
    // grip at once with no move in between; give it the move's elbow limit for a moment too.
    const holdSwitch=view.mode==='paired'&&view.hold&&this.lastMode.startsWith('paired')&&this.lastMode!=='paired'+view.clip;
    this.moveElbowCarry=view.mode==='paired'&&!view.hold||holdSwitch?.4:Math.max(0,this.moveElbowCarry-dt);
    // A carried limit glides the elbow to the hold's own bend; lifting it clear of the mat as a
    // move does would park it somewhere the hold never goes (flat: tucked under the chest).
    const carriedIntoHold=view.mode==='paired'&&view.hold&&view.clip!=='exposed'&&!this.barElbowContinuity;
    // On the feet the hands reach across a metre for wrists, ties and taps, often near full extension,
    // where the elbow's bend plane is ill-defined and used to flip sides in one frame (forearm pops in
    // hand fighting with the hand itself moving slowly). Limit how fast it turns there too.
    const footElbow=!this.instant&&(view.mode==='stance'||view.mode==='walk')?12:Infinity;
    this.solver.beginElbowFrame(dt,!this.instant&&this.barElbowContinuity?4:view.mode==='paired'&&!freeBend&&(!view.hold||view.clip==='exposed'||(view.clip==='flat'&&this.exposedElbowCarry>0)||this.moveElbowCarry>0)?14:footElbow,!carriedIntoHold);
    this.contacts = [];
    this.footContacts = [];
    const modeKey = view.mode + (view.mode === 'paired' ? view.clip : view.mode === 'solo' ? view.clip : '');
    const changed = modeKey !== this.lastMode;
    // Getting up off the mat takes a moment: into the walk back, and into the celebration or the
    // loser's pose when the match ends in a hold on the mat (that one sprang up in a single beat).
    if (changed && view.mode === 'walk' && /^(paired|solo)/.test(this.lastMode)) this.riseT = 0.9;
    if (changed && view.mode === 'solo' && /^paired/.test(this.lastMode)) this.riseT = 0.9;
    this.riseT = view.mode === 'walk' || view.mode === 'solo' ? Math.max(0, this.riseT - dt) : 0;
    if(this.gripTransfer)this.gripTransfer.age+=Math.max(0,dt);
    if(changed || this.instant) {
      this.legFinishStart = null;
      // A captured leg may still be low when Drive wins. Start the finish at
      // the pose actually held, then join its first running/lifting key.
      const finishEntry = view.mode === 'paired' && !view.hold
        ? view.clip === 'finishSingle' ? 0.35 : view.clip === 'finishHighCrotch' ? 0.3
        : view.clip === 'liftedLegTrip' || view.clip === 'liftedLegDrive' ? 0.35 : 0 : 0;
      if (!this.instant && finishEntry && ['pairedlegsSingle','pairedlegsHighCrotch'].includes(this.lastMode)) {
        this.legFinishStart = this.display.slice();
        this.legFinishBlendEnd = finishEntry;
        for (const side of ['L','R'] as const) {
          for (const [at,bone] of [[side==='L'?P.FOOT_L:P.FOOT_R,`toe${side}`],
            [side==='L'?P.HAND_L:P.HAND_R,`hand${side}`]] as const) {
            const point = this.bonePos(bone as BoneName, new Vector3());
            for (let axis=0;axis<3;axis++) this.legFinishStart[at+axis] = point.getComponent(axis);
          }
        }
      }
    }
    if(changed) {
      this.gripTransfer=null;
      const gatherDouble=view.mode==='paired' && view.role==='A' && view.clip==='legsDouble' && ['pairedlegsSingle','pairedlegsHighCrotch'].includes(this.lastMode);
      const settleHeadlock=view.mode==='paired' && view.clip==='fhl' && this.lastMode==='pairedsprawlOut';
      if(!this.instant && opp && view.mode==='paired' && (gatherDouble||settleHeadlock)){
        const anchors={} as Record<'L'|'R',{bone:BoneName;at:Vector3}>;
        for(const hand of ['L','R'] as const){
          const bone=this.gripBone[hand]??(gatherDouble?(view.mirror?'thighL':'thighR'):'chest');
          const anchor=opp.character.bones[bone];anchor.updateWorldMatrix(true,false);
          anchors[hand]={bone,at:this.bonePos(`hand${hand}`,new Vector3()).applyMatrix4(anchor.matrixWorld.clone().invert())};
        }
        this.gripTransfer={age:0,near:gatherDouble?(view.mirror?'R':'L'):null,duration:gatherDouble ? .34 : .24,anchors};
      }
      this.fhlPeelRelease=null;
      if(view.mode==='paired' && view.role==='B' && ['recover','goBehind','chinWhip','shuck','cementMixer'].includes(view.clip) && this.lastMode==='pairedfhl' && !this.instant){
        const hand=view.mirror?'L':'R';
        const start=this.bonePos(`hand${hand}`,new Vector3());
        this.fhlPeelRelease={hand,start,age:0};
        const pose=this.display.slice(),at=hand==='L'?P.HAND_L:P.HAND_R;
        for(let axis=0;axis<3;axis++)pose[at+axis]=start.getComponent(axis);
        this.spring.reset(pose);this.gripW[hand]=0;
      }
      this.recoveryStart=null;
      this.legReleaseStart=null;
      const releasingLeg = ['pairedcatchRidingLeg','pairedcatchRidingLegFlat','pairedlegRide','pairedlegRideFlat','pairedlegRidePressure'].includes(this.lastMode);
      // A cleared boot changes the rider's hand anchors. Begin that regrip at
      // the solved wrists rather than snapping a fully weighted old grip.
      if(view.mode==='paired'&&!this.instant&&((view.clip==='ride'&&this.lastMode==='pairedseatedDefenseRecovered')
        || (releasingLeg&&(view.clip==='ride'||view.clip==='flat')))){
        if(releasingLeg)this.legReleaseAge=0;
        const start=this.display.slice();
        for(const side of ['L','R'] as const){
          const point=this.bonePos(`hand${side}`,new Vector3());
          const at=side==='L'?P.HAND_L:P.HAND_R;
          for(let axis=0;axis<3;axis++)start[at+axis]=point.getComponent(axis);
          this.gripW[side]=0;
        }
        if(releasingLeg){
          for(const side of ['L','R'] as const){
            const point=this.bonePos(`toe${side}`,new Vector3()),at=side==='L'?P.FOOT_L:P.FOOT_R;
            for(let axis=0;axis<3;axis++)start[at+axis]=point.getComponent(axis);
          }
          this.legReleaseStart=start;
        }
        this.spring.reset(start);
      }
      if(view.mode==='paired' && view.clip==='recoverSeatedLegDefense' && this.lastMode==='pairedsitAndCircleLegDefense' && !this.instant) {
        const start=this.display.slice();
        for(const side of ['L','R'] as const) {
          for(const [at,bone] of [[side==='L'?P.FOOT_L:P.FOOT_R,`toe${side}`],
            [side==='L'?P.HAND_L:P.HAND_R,`hand${side}`]] as const) {
            const point=this.bonePos(bone as BoneName,new Vector3());
            for(let axis=0;axis<3;axis++)start[at+axis]=point.getComponent(axis);
          }
        }
        this.recoveryStart=start;
        // Start from the solved contacts, not stale unconstrained foot targets.
        this.spring.reset(start);
        // The captured posting hand already includes the outgoing waist grip.
        // Do not apply that fading constraint twice on the first recovery frame.
        this.gripW[view.mirror?'L':'R']=0;
      }
    }
    this.lastMode = modeKey;
    // Authored contact windows are normalized to the move. Preserve that timing
    // on fast entries instead of adding the same long grip lag to every shot.
    const clipRate = view.mode === 'paired' && !view.hold && !changed && dt > 0
      ? Math.max(0, (view.u - this.lastClipU) / dt) : 1;
    this.contactAcquireRate = this.legReleaseAge<.55 ? 1+15*this.legReleaseAge/.55 : Math.max(16, Math.min(96, 16 * clipRate));
    // Gather the inside-arm grip while the low-base defender rotates toward it.
    if(view.mode==='paired'&&view.clip==='catchRidingLegFlat'&&view.role==='B')this.contactAcquireRate=12;
    this.contactReleaseRate = Math.max(10, Math.min(60, 10 * clipRate));
    const timedRecovery=view.mode==='paired'&&!view.hold&&view.clip==='armBarSupportedSeatedExitDraft';
    this.recoveryClockRate=timedRecovery?Math.max(.05,clipRate)*.85:1;
    if(timedRecovery)this.contactReleaseRate=10*Math.max(.05,clipRate);
    this.lastClipU = view.mode === 'paired' ? view.u : 0;
    if (changed) this.effortPulse.clearQueued();

    let footTarget = 0;
    switch (view.mode) {
      case 'stance':
        this.buildStance(view, opp);
        // Footwork keeps the feet through the down block too and steps them back to its hop; letting go
        // made the feet jump from where they were planted to the posed spot (toe pops).
        footTarget = 1;
        this.halfLife = view.act === 'sprawl' ? 0.045 : view.act === 'snap' ? 0.05 : 0.075;
        if (view.act === 'stance') this.halfLife += .025 * this.walkingOverlay;
        break;
      case 'walk':
        this.buildWalk(view, opp);
        footTarget = 1;
        // Getting up from the mat takes a moment; a plain stop-and-walk is quick.
        this.halfLife = this.riseT > 0 ? 0.22 : 0.1;
        break;
      case 'paired':
        this.buildPaired(view, opp);
        // Standing control keeps live foot plants as the defender turns out.
        // Throws and mat returns retain their authored airborne trajectories.
        // Leg battles step too (owner: he walks him around the mat): only the free feet, see legFeetFree.
        footTarget = view.hold && (view.clip === 'standing' || LEG_BATTLE_CLIPS.has(view.clip)) ? 1 : 0;
        // Preserve the authored timing on fast moves; a fixed pose delay can
        // otherwise leave a defensive post airborne after its grip releases.
        this.halfLife = view.hold ? (view.clip==='legRidePressure'?.2:view.clip==='catchRidingLegFlat'?.12:.09) : changed ? 0.06
          : 0.035 / Math.max(1, Math.min(4, clipRate));
        break;
      case 'solo':
        this.buildSolo(view, opp);
        footTarget = 0;
        this.halfLife = this.riseT > 0 ? 0.22 : 0.09;
        break;
    }

    if(timedRecovery&&!changed)this.halfLife=.035/Math.max(.05,clipRate);
    // A chop is a strike (CHOP): the pose follows it at once instead of easing it into a pull.
    if(view.mode==='paired'&&view.hold&&(view.clip==='ride'||view.clip==='flat')&&this.effortPulse.button==='fight'&&this.effortPulse.age<CHOP.duration
      &&(view.role==='A'?!this.effortPulse.reaction:this.effortPulse.reaction))this.halfLife=Math.min(this.halfLife,.025);
    // Release the peeling hand from its actual forearm contact into the free recovery path.
    if(this.fhlPeelRelease){
      const r=this.fhlPeelRelease;r.age+=dt;
      const u=Math.min(1,r.age/.2),blend=u*u*(3-2*u),at=r.hand==='L'?P.HAND_L:P.HAND_R;
      for(let axis=0;axis<3;axis++)this.target[at+axis]=r.start.getComponent(axis)*(1-blend)+this.target[at+axis]*blend;
      if(u===1)this.fhlPeelRelease=null;
    }

    // Exertion shows in skin and breathing.
    const ex = 'exertion' in view ? view.exertion : 0;
    const st = 'stamina' in view ? view.stamina : 1;
    this.character.setExertion(Math.min(1, 0.12 + (1 - st) * 0.6 + ex * 0.3), Math.min(1, ex * 0.8 + (1 - st) * 0.5));

    // Transitions get a slightly longer blend so the body travels between states.
    // Ease out of the slow post-release spring. Dropping it all at once would make
    // any move started in that window lurch forward at the 1.2 s mark.
    const releaseHalfLife=Math.min(.18-.09*this.legReleaseAge/1.2,(1.2-this.legReleaseAge)/.3*.1125);
    // Leaving stance for a move, ease across the gap between the real stance and the
    // clip's opening pose. Tightening at once snaps the whole body in two frames.
    if(changed&&view.mode==='paired'&&!view.hold&&this.prevWasStance)this.stanceExit=.14;
    this.stanceExit=Math.max(0,this.stanceExit-dt);
    this.prevWasStance=view.mode==='stance';
    if(this.stanceExit>0)this.halfLife=Math.max(this.halfLife,.012+.07*this.stanceExit/.14);
    const hl = this.legReleaseAge<1.2 ? Math.max(this.halfLife,releaseHalfLife) : changed ? Math.max(this.halfLife, 0.07) : this.halfLife;
    if (this.instant) {
      this.spring.reset(this.target);
      // A hard cut also moves the feet and leaves no momentum behind.
      this.footwork.invalidate();
      this.prevHx = NaN;
      this.prevHz = NaN;
      this.velX = 0;
      this.velZ = 0;
      this.instant = false;
    } else {
      if((timedRecovery || (view.mode==='paired' && ['armBarSupportedSeatedTurnDraft','armBarSupportedResistedDraft'].includes(view.clip))) && !changed && dt>0){
 const steps=Math.max(1,Math.ceil(dt*120));
 for(let i=1;i<=steps;i++){
  blendPosture(this.previousRecoveryTarget,this.target,i/steps,this.sampledRecoveryTarget);
  this.spring.update(this.sampledRecoveryTarget,dt/steps,hl);
 }
}else this.spring.update(this.target,dt,hl);
    }
    this.previousRecoveryTarget.set(this.target);
    this.display.set(this.spring.value);
    this.applyMass(dt);

    // Footwork takes the feet whenever the body is on its feet and free.
    // Procedural arm/hip motion lives after the pose spring, so it needs its
    // own transition envelope when the wrestler lowers into a working stance.
    this.walkingOverlay += ((view.mode === 'walk' ? 1 : 0) - this.walkingOverlay) * (1 - Math.exp(-dt / .1));
    const wasPlanted = this.footW > 0.01;
    this.footW += (footTarget - this.footW) * Math.min(1, dt * (footTarget > this.footW ? 9 : 14));
    if (footTarget > 0) {
      if (!wasPlanted || !this.footwork.isPrimed) this.footwork.reset(this.display);
      let vx = 'vx' in view ? view.vx : 0;
      let vz = 'vz' in view ? view.vz : 0;
      const legBattle = view.mode === 'paired' && LEG_BATTLE_CLIPS.has(view.clip);
      if (legBattle) {
        // The hold travels and circles: lead the steps with how fast his hips are moving over the mat.
        if (Number.isFinite(this.legPrevX) && dt > 0) {
          const k = Math.min(1, dt * 10);
          this.legVx += ((this.target[P.HIPS] - this.legPrevX) / dt - this.legVx) * k;
          this.legVz += ((this.target[P.HIPS + 2] - this.legPrevZ) / dt - this.legVz) * k;
        }
        this.legPrevX = this.target[P.HIPS];
        this.legPrevZ = this.target[P.HIPS + 2];
        vx = this.legVx;
        vz = this.legVz;
        // A foot held up in his hands, or a knee down on the mat, stays with the pose; the others step.
        for (let i = 0; i < 2; i++) {
          const at = i === 0 ? P.FOOT_L : P.FOOT_R;
          const want = Math.max(0, Math.min(1, (0.09 * this.scale - this.target[at + 1]) / (0.04 * this.scale)))
            * Math.max(0, Math.min(1, (0.75 - this.target[at + FOOT.HEEL]) / 0.25));
          this.legFree[i] += (want - this.legFree[i]) * Math.min(1, dt * 8);
        }
      } else {
        this.legPrevX = NaN;
        this.legVx = this.legVz = 0;
        this.legFree[0] = this.legFree[1] = 1;
      }
      this.footwork.update(dt, this.feetDesired, vx, vz, view.mode === 'walk' ? 1 : 1.05 * this.character.motion.tempo, view.mode === 'walk', this.scale, this.legFree);
      this.footwork.apply(this.display, this.footW);
      this.display[P.HIPS + 1] += this.footwork.bounce * this.footW;
      const support = this.footwork.support * this.footW;
      // In stance the weight rides over the planted foot while the other steps, as fighters
      // do (reference: EA UFC 5 footwork, AlbohmgKCoM); walking keeps its gentler shift.
      const sway = .035 - .021 * this.walkingOverlay;
      const yaw = 'yaw' in view ? view.yaw : view.mode === 'paired' ? view.frame.yaw : 0;
      this.display[P.HIPS] += Math.cos(yaw) * support * sway * this.scale;
      this.display[P.HIPS + 2] -= Math.sin(yaw) * support * sway * this.scale;
      if (this.walkingOverlay > .001) {
        // Arm swing follows the actual leg separation, not an unrelated clock.
        const dx = this.display[P.FOOT_L] - this.display[P.FOOT_R];
        const dz = this.display[P.FOOT_L + 2] - this.display[P.FOOT_R + 2];
        // Once guard transition starts, fade the last walking swing; the new
        // staggered stance feet must not start another walking arm swing.
        if (view.mode === 'walk') this.walkingStride = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / this.scale;
        const stride = this.walkingStride;
        // Hands on the hips don't swing.
        // Running pumps the arms harder (owner: run back to the center).
        const pump = 1 + this.walkRun * 0.6;
        const swing = Math.max(-.17 * pump, Math.min(.17 * pump, stride * .42 * pump)) * this.scale * this.walkingOverlay * (1 - this.walkTired);
        for (const [at, sign] of [[P.HAND_L, -1], [P.HAND_R, 1]] as const) {
          this.display[at] += Math.sin(yaw) * swing * sign;
          this.display[at + 2] += Math.cos(yaw) * swing * sign;
          // A relaxed arm swings about the shoulder, rising at both extremes.
          this.display[at + 1] += swing * swing / (.9 * this.scale);
        }
        // Elbows travel with the hands instead of being pinned behind the torso.
        for (const [at, sign] of [[P.ELBOW_L, -1], [P.ELBOW_R, 1]] as const) {
          this.display[at] += Math.sin(yaw) * swing * sign * .55;
          this.display[at + 2] += Math.cos(yaw) * swing * sign * .55;
        }
        // Advance the hip of the forward leg; the shoulders counter-rotate.
        // Apply a local yaw to the existing root quaternion, preserving heading.
        const hipTurn = Math.max(-.065, Math.min(.065, stride * -.14)) * this.walkingOverlay;
        this.gaitRotation.fromArray(this.display, P.HIPS_Q);
        this.gaitYaw.setFromAxisAngle(this.gaitAxis, hipTurn);
        this.gaitRotation.multiply(this.gaitYaw).normalize().toArray(this.display, P.HIPS_Q);
        this.display[P.SPINE + 1] += swing / this.scale * .35 - hipTurn;
        this.display[P.SPINE + 2] -= support * .018 * this.walkingOverlay;
      }
    } else if (this.footW >= 0.01 && this.footwork.isPrimed) {
      // Letting go of the planted feet (a shot, a solo pose, a move): fade out from where they were
      // planted. Dropping footwork at once snapped the feet to the new pose in one frame (toe pops as a
      // shot starts, shin pops on the first frame of the celebration).
      this.footwork.apply(this.display, this.footW);
    } else if (this.footW < 0.01) {
      this.footwork.invalidate();
    }

    if(view.mode==='paired'&&view.role==='A'&&!view.hold&&/^(armBar|wristBar|barHalf|doubleBar)Resisted$/.test(view.clip)){
      // Ease into the authored foot plants before driving pressure. The body
      // keeps its spring, but landed feet must not trail the completed step.
      const ramp=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
      const wrist=view.clip==='wristBarResisted';
      const first=wrist?.30:.18,land=wrist?.48:.35,release=wrist?.68:.55,recover=wrist?.84:.78;
      const plant=ramp((view.u-first)/(land-first))*ramp((recover-view.u)/(recover-release));
      for(const at of [P.FOOT_L,P.FOOT_R])for(let axis=0;axis<3;axis++){
        this.display[at+axis]+=(this.target[at+axis]-this.display[at+axis])*plant;
      }
    }

    if(view.mode==='paired'&&view.role==='A'&&!view.hold&&view.clip==='armBarSupportedResistedDraft'){
      // Land the support foot on the authored target instead of allowing
      // the posture spring to keep sliding it after touchdown.
      const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
      const weight=smooth((view.u-.16)/.065)*smooth((.84-view.u)/.065);
      const at=view.mirror?P.FOOT_L:P.FOOT_R;
      for(let axis=0;axis<3;axis++)this.display[at+axis]+=(this.target[at+axis]-this.display[at+axis])*weight;
    }

    const legPath=view.mode==='paired' && ['flatPressureDraft','armBarSupportedSeatedTurnDraft','armBarSupportedSeatedFinishDraft','armBarSupportedSeatedExitDraft'].includes(view.clip);
    if(legPath && this.legPathReady && dt>0){
      const steps=Math.max(1,Math.ceil(dt*120));
      const floor=flatSupportDraft?(view.mode==='paired'&&view.clip==='armBarSupportedSeatedExitDraft'?.06:.07):.04;
      for(let i=1;i<=steps;i++){
        blendPosture(this.previousLegPose,this.display,i/steps,this.legPathPose);
        this.solver.beginKneeFrame(dt*jointClock/steps,4,floor,Infinity);
        this.solver.applyLegPath(this.legPathPose);
      }
      this.solver.beginKneeFrame(0,4,floor,Infinity);
    }
    this.previousLegPose.set(this.display);this.legPathReady=legPath;
    this.solver.apply(this.display);
    if(view.mode==='paired'&&view.role==='A'&&view.clip==='armBarSupportedSeatedExitDraft'){
      const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
      const weight=smooth((view.u-.08)/.14)*(1-smooth((view.u-.70)/.18));
      if(weight>0){
        const hand=view.mirror?'R':'L',sign=view.mirror?-1:1;
        const chest=this.character.bones.chest;chest.updateWorldMatrix(true,false);
        // Withdraw on the same side of the ribs, then reach back to the ride.
        const target=new Vector3(sign*.32,-.10,.18).multiplyScalar(this.scale).applyMatrix4(chest.matrixWorld);
        target.y=Math.max(.10*this.scale,target.y);
        const pole=new Vector3(sign*.46,.05,.06).multiplyScalar(this.scale).applyMatrix4(chest.matrixWorld);
        const h=hand==='L'?P.HAND_L:P.HAND_R,e=hand==='L'?P.ELBOW_L:P.ELBOW_R;
        for(let axis=0;axis<3;axis++){this.display[h+axis]+=(target.getComponent(axis)-this.display[h+axis])*weight;this.display[e+axis]+=(pole.getComponent(axis)-this.display[e+axis])*weight;}
        this.solver.reachArm(this.display,hand);
      }
    }
    if (opp && this.character.setGaze) this.character.setGaze(opp.headPos(this.gazeTarget));
  }

  /* ----------------------------------------------------------------- mass */

  // A body has mass: the trunk lags when the hips accelerate and settles with
  // a little overshoot; the head lags the trunk. Impacts kick the same springs.
  private lag = { p: 0, pv: 0, r: 0, rv: 0 };
  private prevHx = NaN;
  private prevHz = 0;
  private velX = 0;
  private velZ = 0;

  /** A jolt through the body, e.g. landing on the mat or a hand-fight yank. */
  impulse(strength: number, sideways = 0): void {
    this.lag.pv += strength * 3.2;
    this.lag.rv += sideways * 3;
  }

  private applyMass(dt: number): void {
    const d = this.display;
    const hx = d[P.HIPS];
    const hz = d[P.HIPS + 2];
    if (Number.isNaN(this.prevHx) || dt <= 0) {
      this.prevHx = hx;
      this.prevHz = hz;
      return;
    }
    const vx = (hx - this.prevHx) / dt;
    const vz = (hz - this.prevHz) / dt;
    this.prevHx = hx;
    this.prevHz = hz;
    const ax = (vx - this.velX) / dt;
    const az = (vz - this.velZ) / dt;
    this.velX += (vx - this.velX) * Math.min(1, dt * 20);
    this.velZ += (vz - this.velZ) * Math.min(1, dt * 20);
    // Acceleration in the pelvis frame.
    const qy = d[P.HIPS_Q + 1];
    const qw = d[P.HIPS_Q + 3];
    const yaw = 2 * Math.atan2(qy, qw);
    const fwd = ax * Math.sin(yaw) + az * Math.cos(yaw);
    const side = ax * Math.cos(yaw) - az * Math.sin(yaw);
    const clampA = (v: number) => Math.max(-14, Math.min(14, v));
    // Damped springs (about 5 Hz, a little under critical).
    const k = 900;
    const c = 34;
    const L = this.lag;
    // Integrate inertia in small steps: a single 50ms update can make this
    // stiff spring unstable and leave the torso shaking after the player stops.
    const steps = Math.max(1, Math.ceil(dt * 120));
    const step = dt / steps;
    const pitchForce = -clampA(fwd) * 6;
    const rollForce = clampA(side) * 4;
    for (let i = 0; i < steps; i++) {
      L.pv += (-k * L.p - c * L.pv + pitchForce) * step;
      L.p += L.pv * step;
      L.rv += (-k * L.r - c * L.rv + rollForce) * step;
      L.r += L.rv * step;
    }
    L.p = Math.max(-0.25, Math.min(0.25, L.p));
    L.r = Math.max(-0.2, Math.min(0.2, L.r));
    d[P.SPINE] += L.p;
    d[P.SPINE + 2] += L.r;
    d[P.HEAD] -= L.p * 0.7;
    d[P.HEAD + 2] -= L.r * 0.8;
  }

  /** Second pass, once both bodies are posed: close grips onto the opponent. */
  applyContacts(dt: number, opp: Animator | null): void {
    // Solve the hooked leg before hands that may be holding the shin.
    // Weight is clip-authored, including acquisition/release; no persistent lock.
    if(opp) for(const c of this.footContacts) {
      const bone=opp.character.bones[c.on];bone.updateWorldMatrix(true,false);
      const anchor=new Vector3(...c.at).multiplyScalar(opp.scale).applyMatrix4(bone.matrixWorld);
      const foot=c.foot==='L'?P.FOOT_L:P.FOOT_R;
      const saved=[this.display[foot],this.display[foot+1],this.display[foot+2]];
      const w=c.weight*c.weight*(3-2*c.weight);
      for(let axis=0;axis<3;axis++)this.display[foot+axis]+=(anchor.getComponent(axis)-this.display[foot+axis])*w;
      this.solver.reachFoot(this.display,c.foot);
      // Preserve the unconstrained spring state for a continuous release.
      for(let axis=0;axis<3;axis++)this.display[foot+axis]=saved[axis];
    }
    const claspContacts=this.contacts.filter(c=>c.clasp);
    let clasp:Vector3|null=null;
    if(opp && claspContacts.length===2){
      const anchors=claspContacts.map(c=>{
        const b=opp.character.bones[c.on];b.updateWorldMatrix(true,false);
        return new Vector3().fromArray(c.at).multiplyScalar(opp.scale).applyMatrix4(b.matrixWorld);
      });
      if(anchors[0].distanceTo(anchors[1])<.22*this.scale)this.cradleClaspLocked=true;
      this.cradleClaspBlend=this.cradleClaspLocked?Math.min(1,this.cradleClaspBlend+dt*7):0;
      if(this.cradleClaspLocked){
        const neckContact=claspContacts.find(c=>c.on==='neck'||c.on==='head');
        const legContact=claspContacts.find(c=>c.on.startsWith('shin')||c.on.startsWith('thigh'));
        const neck=opp.bonePos(neckContact?.on??claspContacts[0].on,new Vector3());
        const knee=opp.bonePos(legContact?.on??claspContacts[1].on,new Vector3());
        clasp=neck.clone().lerp(knee,.2);
        // Lock beside the chin/neck, not pulled back toward the attacker's hip.
        // Side clearance is perpendicular to the folded head-to-knee axis.
        const axis=neck.clone().sub(knee);axis.y=0;axis.normalize();
        const outside=new Vector3(this.display[P.HIPS]-clasp.x,0,this.display[P.HIPS+2]-clasp.z);
        outside.addScaledVector(axis,-outside.dot(axis)).normalize();
        clasp.addScaledVector(outside,.13*this.scale);
        clasp.y+=.035*this.scale;
      }
    }else{this.cradleClaspLocked=false;this.cradleClaspBlend=0;}
    const backClasp=this.contacts.find(c=>c.backClasp);
    if(opp&&backClasp){
      const anchor=opp.character.bones[backClasp.on];anchor.updateWorldMatrix(true,false);
      clasp=new Vector3(...backClasp.at).multiplyScalar(opp.scale).applyMatrix4(anchor.matrixWorld);
    }
    for (const hand of ['L', 'R'] as const) {
      const candidates=this.contacts.filter(x=>x.hand===hand);
      const c=this.lastMode==='pairedarmBarSupportedSeatedTurnDraft'?candidates.reduce<(typeof candidates)[number]|undefined>((best,x)=>!best||x.weight>best.weight?x:best,undefined):candidates[0];
      const want = c && opp ? c.weight : 0;
      const handoff=this.handoff[hand],handoffDraft=['pairedarmBarSupportedSeatedExitDraft','pairedarmBarSupportedResistedDraft'].includes(this.lastMode);
      const nextBone=c?.on??null;
      if(handoffDraft && handoff.valid && nextBone!==handoff.bone){
        handoff.start.copy(handoff.last);handoff.rotation.copy(handoff.lastRotation);handoff.age=0;handoff.acquiring=!!nextBone;this.handoffWantStart[hand]=this.phaseContactStart[hand];this.palmDelta[hand]=null;this.handoffDelta[hand]=null;
      }
      handoff.bone=nextBone;
      const saveHand=()=>{const wrist=this.character.bones['hand'+hand as BoneName];
        if(this.lastMode==='pairedarmBarSupportedSeatedExitDraft'&&!c&&handoff.valid&&hand!==this.barGuideHand&&dt>0){
          const target=wrist.getWorldQuaternion(new Quaternion());
          const world=handoff.lastRotation.clone().rotateTowards(target,6*dt);
          const fore=this.character.bones['forearm'+hand as BoneName];
          wrist.quaternion.copy(fore.getWorldQuaternion(new Quaternion()).invert().multiply(world));
          wrist.updateWorldMatrix(false,true);
        }
        wrist.getWorldPosition(handoff.last);wrist.getWorldQuaternion(handoff.lastRotation);handoff.valid=true;};
      const continuity=()=>{
        if(!handoffDraft||(!handoff.acquiring&&handoff.age>=.10))return;
        handoff.age+=dt*this.recoveryClockRate;
        const from=this.handoffWantStart[hand];
        const u=handoff.acquiring?(from<.999?Math.max(0,Math.min(1,(want-from)/(1-from))):Math.min(1,handoff.age/.10)):Math.min(1,handoff.age/.10),t=u*u*(3-2*u);
        const at=hand==='L'?P.HAND_L:P.HAND_R;
        const wrist=this.character.bones['hand'+hand as BoneName];
        let target=wrist.getWorldPosition(new Vector3()),rotation=wrist.getWorldQuaternion(new Quaternion());
        if(handoff.acquiring && c && opp){
          const anchor=opp.character.bones[c.on];anchor.updateWorldMatrix(true,false);
          const point=new Vector3(...c.at).multiplyScalar(opp.scale).applyMatrix4(anchor.matrixWorld);
          const q=anchor.getWorldQuaternion(new Quaternion());
          if(c.palm){
            const grip=palmGrip(point,new Vector3(c.at[0],0,c.at[2]).applyQuaternion(q),new Vector3(0,1,0).applyQuaternion(q),hand,this.scale);
            target=grip.wrist;rotation=grip.rotation;
          }else target=point;
          if(want>=1 && u>=1){handoff.acquiring=false;handoff.age=.10;}
        }
        target.lerpVectors(handoff.start,target,t);
        if(opp){
          const outward=target.clone().sub(opp.bonePos('chest',new Vector3()));if(!(handoff.acquiring && c?.on==='chest'))outward.y=0;
          if(outward.lengthSq()>1e-8)target.addScaledVector(outward.normalize(),(handoff.acquiring && c?.on==='chest' ? .08*(this.scale+opp.scale) : ((handoff.acquiring && c && /^forearm/.test(c.on)) ? .035*(this.scale+opp.scale) : .05*this.scale))*Math.sin(Math.PI*t)**2);
        }
        this.display[at]=target.x;this.display[at+1]=target.y;this.display[at+2]=target.z;
        this.solver.reachArm(this.display,hand);
        const fore=this.character.bones['forearm'+hand as BoneName];
        const delta=handoff.rotation.clone().invert().multiply(rotation).normalize();
const previous=this.handoffDelta[hand];
if(previous ? delta.dot(previous)<0 : delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
this.handoffDelta[hand]=delta.clone();
const axis=new Vector3(delta.x,delta.y,delta.z),length=axis.length();
const blended=handoff.rotation.clone();
if(length>1e-8)blended.multiply(new Quaternion().setFromAxisAngle(axis.divideScalar(length),2*Math.atan2(length,delta.w)*t));
wrist.quaternion.copy(fore.getWorldQuaternion(new Quaternion()).invert().multiply(blended));
        wrist.updateWorldMatrix(false,true);
      };
      if (c) {
        // A new bar/half anchor is a reach, not an already-locked old waist grip.
        if(/^paired(armBar|wristBar|barHalf|doubleBar)/.test(this.lastMode) && this.gripBone[hand]!==c.on)this.gripW[hand]=0;
        this.gripBone[hand] = c.on;
        this.gripAt[hand].set(c.at[0], c.at[1], c.at[2]);
        this.gripPalm[hand]=!!c.palm;
      }
      const rate = want > this.gripW[hand] ? this.contactAcquireRate : this.contactReleaseRate;
      // Isolated recovery experiment: compose the existing 60Hz response over
      // elapsed time, rather than making low frame rates acquire more strongly.
      const recoveryDraft = ['pairedarmBarPressureSeatedExitDraft','pairedarmBarSupportedSeatedExitDraft'].includes(this.lastMode);
      const blend = recoveryDraft
        ? (dt <= 0 ? 0 : 1 - Math.pow(1 - Math.min(1, rate / 60), dt * 60))
        : Math.min(1, dt * rate);
      if(this.lastMode==='pairedarmBarSupportedSeatedTurnDraft' && dt>0){
 const steps=Math.max(1,Math.ceil(dt*120)),prior=this.authoredGripWant[hand];
 for(let i=1;i<=steps;i++){
  const sampledWant=prior+(want-prior)*i/steps;
  const sampledRate=sampledWant>this.gripW[hand]?this.contactAcquireRate:this.contactReleaseRate;
  this.gripW[hand]+=(sampledWant-this.gripW[hand])*(1-Math.exp(-sampledRate*dt/steps));
 }
}else if(handoffDraft && want>=this.authoredGripWant[hand])this.gripW[hand]=want*want*(3-2*want);else this.gripW[hand] += (want - this.gripW[hand]) * blend;
this.authoredGripWant[hand]=want;
      const w = this.gripW[hand];
      const bone = this.gripBone[hand];
      // A collar or thigh contact needs an open hook; wrist control can close
      // farther. Contact strength still controls the arm attachment separately.
      const aperture=bone==='neck'||bone==='head'?.5:
        bone?.startsWith('forearm')?.72:bone?.startsWith('hand')?.85:
        bone?.startsWith('shin')?.6:bone?.startsWith('thigh')?.35:.4;
      this.character.setGrip?.(hand,w*(clasp?.8:aperture),clasp?'gable':'hook');
      // A free hand forgets its old anchor, so a later grip never glides from a stale spot.
      if (w < 0.01 || !bone || !opp) { this.gripRelease[hand].age=1; this.handFightAnchor[hand].bone=null; continuity();saveHand();continue; }
      const ob = opp.character.bones[bone];
      ob.updateWorldMatrix(true, false);
      _v.copy(this.gripAt[hand]).multiplyScalar(opp.scale).applyMatrix4(ob.matrixWorld);
      // A held grip that moves to another bone (wrist to arm to neck, waist to thigh...) glides
      // there at hand speed instead of teleporting, in stance and in every move. The arm-bar
      // drafts keep their own hand-over above.
      const fight=this.handFightAnchor[hand];
      if(!handoffDraft){
        // Also when the grip moves on the same bone (front of the chest to the back when a high crotch goes to
        // the double): that jumped 20 cm in one frame.
        const moved=fight.bone===bone&&fight.at.distanceTo(this.gripAt[hand])>.05;
        if(fight.bone&&(fight.bone!==bone||moved)){fight.from.copy(fight.last);fight.age=0;fight.dur=Math.max(.12,Math.min(.35,fight.from.distanceTo(_v)/1.5));}
        fight.bone=bone;fight.at.copy(this.gripAt[hand]);
        fight.age+=dt;
        const glide=Math.min(1,fight.age/(fight.dur||.2));
        if(glide<1)_v.lerpVectors(fight.from,_v,glide*glide*(3-2*glide));
        fight.last.copy(_v);
      }else fight.bone=null;
      const boneRotation=ob.getWorldQuaternion(new Quaternion());
      const doubleExit=this.lastMode==='paireddoubleBarExit' && bone==='chest';
      const lock=doubleExit ? backGableGrip(_v,boneRotation,hand,this.scale) : clasp && c?.backClasp ? backGableGrip(clasp,boneRotation,hand,this.scale)
        : clasp && c?.clasp ? gableGrip(clasp,new Vector3(this.display[P.HIPS]-clasp.x,0,this.display[P.HIPS+2]-clasp.z),hand,this.scale,c.on==='neck'||c.on==='head') : null;
      const radial=new Vector3(this.gripAt[hand].x,0,this.gripAt[hand].z);
      // Supported wrist curl: fingers wrap toward the elbow, keeping the
      // riders wrist on the reachable side of the secured contact.
      const wristCurl=(this.lastMode==='pairedarmBarSupportedSeatedFinishDraft'||(this.lastMode==='pairedarmBarSupportedSeatedTurnDraft'&&this.lastClipU>=.28)||(this.lastMode==='pairedarmBarSupportedSeatedExitDraft'&&hand!==this.barGuideHand))&&!c?.elbowGuide&&bone.startsWith('forearm');
      const palm=!lock && this.gripPalm[hand] && radial.lengthSq()>1e-8
        ? palmGrip(_v,radial.applyQuaternion(boneRotation),new Vector3(0,wristCurl?-1:1,0).applyQuaternion(boneRotation),hand,this.scale) : null;
      if(palm)_v.copy(palm.wrist);
      if(this.gripTransfer && this.gripTransfer.age<this.gripTransfer.duration+(this.gripTransfer.near ? .18 : 0)){
        const gather=this.gripTransfer,old=gather.anchors[hand],anchor=opp.character.bones[old.bone];
        anchor.updateWorldMatrix(true,false);
        const start=old.at.clone().applyMatrix4(anchor.matrixWorld);
        // Keep the outgoing grip while reaching for the next control.
        // On a double, the captured leg stays secured until the far-hand scoop.
        const delay=hand===gather.near?.18:0;
        const u=Math.max(0,Math.min(1,(gather.age-delay)/gather.duration)),t=u*u*(3-2*u);
        _v.lerpVectors(start,_v,t);
      }
      if(c?.elbowGuide){
        const guide=c.elbowGuide,anchor=opp.character.bones[guide.on];
        anchor.updateWorldMatrix(true,false);
        const pole=new Vector3(...guide.at).multiplyScalar(opp.scale).applyMatrix4(anchor.matrixWorld);
        const elbow=hand==='L'?P.ELBOW_L:P.ELBOW_R;
        this.display[elbow]+=(pole.x-this.display[elbow])*w;
        this.display[elbow+1]+=(pole.y-this.display[elbow+1])*w;
        this.display[elbow+2]+=(pole.z-this.display[elbow+2])*w;
      }
      // The held wrist is solved after both bodies move. Carry its elbow
      // guide in the current rendered chest frame at that same solve stage.
      if(!c?.elbowGuide && this.barGuideWeight>0&&hand===this.barGuideHand){
        const chest=this.character.bones.chest;chest.updateWorldMatrix(true,false);
        const pole=new Vector3((hand==='L'?1:-1)*.42,.10,.10).multiplyScalar(this.scale).applyMatrix4(chest.matrixWorld);
        const elbow=hand==='L'?P.ELBOW_L:P.ELBOW_R;
        for(let axis=0;axis<3;axis++)this.display[elbow+axis]+=(pole.getComponent(axis)-this.display[elbow+axis])*this.barGuideWeight;
      }
      const wristTurn=this.lastMode==='pairedarmBarSupportedSeatedTurnDraft';
      const wristFinish=this.lastMode==='pairedarmBarSupportedSeatedFinishDraft';
      if((wristTurn||wristFinish)&&!c?.elbowGuide&&bone.startsWith('forearm')){
        // Approach the supported wrist-control elbow branch during sit-through.
        // Keep the existing contact target and angular continuity limits.
        const t=wristFinish?1:Math.max(0,Math.min(1,(this.lastClipU-.66)/.20));
        const blend=t*t*(3-2*t)*w;
        const chest=this.character.bones.chest;chest.updateWorldMatrix(true,false);
        const pole=new Vector3((hand==='L'?-1:1)*.10,.12,-.14).multiplyScalar(this.scale).applyMatrix4(chest.matrixWorld);
        const elbow=hand==='L'?P.ELBOW_L:P.ELBOW_R;
        for(let axis=0;axis<3;axis++)this.display[elbow+axis]+=(pole.getComponent(axis)-this.display[elbow+axis])*blend;
      }
      if(lock){const k=c?.clasp&&!c.backClasp&&!doubleExit?this.cradleClaspBlend:1;_v.lerp(lock.wrist,k*k*(3-2*k));}
      if(lock&&!c?.backClasp&&!doubleExit){
        // Follow the opponent's anatomy rather than a fixed-size elbow pole.
        // The head elbow passes beyond the neck; the leg elbow scoops below
        // the knee on the opposite side of the folded head-to-knee space.
        const neck=opp.bonePos('neck',new Vector3());
        const forward=opp.bonePos('head',new Vector3()).sub(neck);forward.y=0;forward.normalize();
        const headArm=c?.on==='neck'||c?.on==='head';
        const pole=headArm?neck:opp.bonePos(bone,new Vector3());
        pole.addScaledVector(forward,(headArm?.18:-.18)*opp.scale);
        if(headArm){
          const around=neck.clone().sub(this.bonePos(`arm${hand}`,new Vector3()));around.y=0;
          pole.addScaledVector(around.normalize(),.16*opp.scale);
        }
        pole.y=Math.max(.055*this.scale,pole.y-.09*opp.scale);
        const elbow=hand==='L'?P.ELBOW_L:P.ELBOW_R;
        this.display[elbow]+=(pole.x-this.display[elbow])*w;
        this.display[elbow+1]+=(pole.y-this.display[elbow+1])*w;
        this.display[elbow+2]+=(pole.z-this.display[elbow+2])*w;
      }
      const at = hand === 'L' ? P.HAND_L : P.HAND_R;
      if(doubleExit){
        // Peel the opening lock around the ribs with its elbow, rather than
        // interpolating a straight line from the back to the riding pose.
        const inverse=ob.matrixWorld.clone().invert();
        const start=_v.clone().applyMatrix4(inverse);
        const end=new Vector3(this.display[at],this.display[at+1],this.display[at+2]).applyMatrix4(inverse);
        const side=Math.sign(start.x)||1,progress=1-w;
        const control=new Vector3(side*.48*opp.scale,(start.y+end.y)/2,0);
        const around=start.clone().multiplyScalar(w*w).addScaledVector(control,2*w*progress).addScaledVector(end,progress*progress).applyMatrix4(ob.matrixWorld);
        this.display[at]=around.x;this.display[at+1]=around.y;this.display[at+2]=around.z;
        const elbow=hand==='L'?P.ELBOW_L:P.ELBOW_R;
        const pole=new Vector3(side*.48*opp.scale,.08*opp.scale,0).applyMatrix4(ob.matrixWorld);
        const guide=4*w*progress;
        for(let axis=0;axis<3;axis++)this.display[elbow+axis]+=(pole.getComponent(axis)-this.display[elbow+axis])*guide;
      }else{
      this.display[at] += (_v.x - this.display[at]) * w;
      this.display[at + 1] += (_v.y - this.display[at + 1]) * w;
      this.display[at + 2] += (_v.z - this.display[at + 2]) * w;
      }
      const release=this.gripRelease[hand];
      const surfaceGrip=lock ?? (c?.palm ? palm : null);
      if(this.instant && !surfaceGrip)release.age=1;
      let releaseBlend=1;
      if(!surfaceGrip && release.age<.12){
        release.age+=dt;
        const u=Math.min(1,release.age/.12);
        releaseBlend=u*u*(3-2*u);
        // When a clasp or palm grip ends, peel away from the actual wrist
        // pose instead of snapping back to its old bone anchor in one frame.
        for(let axis=0;axis<3;axis++)this.display[at+axis]=release.wrist.getComponent(axis)*(1-releaseBlend)+this.display[at+axis]*releaseBlend;
      }
      this.solver.reachArm(this.display, hand);
      if(surfaceGrip){
        // Wrist orientation is a world-space palm constraint after arm IK.
        const fore=this.character.bones[`forearm${hand}`],wrist=this.character.bones[`hand${hand}`];
        const local=fore.getWorldQuaternion(new Quaternion()).invert().multiply(surfaceGrip.rotation);
        if(handoffDraft){
          const base=wrist.quaternion.clone();
          const delta=base.clone().invert().multiply(local).normalize();
          const previous=this.palmDelta[hand];
          if(previous ? delta.dot(previous)<0 : delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
          this.palmDelta[hand]=delta.clone();
          const axis=new Vector3(delta.x,delta.y,delta.z),length=axis.length();
          if(length>1e-8){
            const angle=2*Math.atan2(length,delta.w);
            wrist.quaternion.copy(base.multiply(new Quaternion().setFromAxisAngle(axis.divideScalar(length),angle*w)));
          }else wrist.quaternion.copy(base);
        }else wrist.quaternion.slerp(local,w);
        wrist.updateWorldMatrix(false,true);
        release.age=0;
        wrist.getWorldPosition(release.wrist);
        wrist.getWorldQuaternion(release.rotation);
      }else if(releaseBlend<1){
        const fore=this.character.bones[`forearm${hand}`],wrist=this.character.bones[`hand${hand}`];
        const local=fore.getWorldQuaternion(new Quaternion()).invert().multiply(release.rotation);
        wrist.quaternion.slerp(local,1-releaseBlend);
        wrist.updateWorldMatrix(false,true);
      }
      continuity();saveHand();
    }
  }

  /* --------------------------------------------------------------- stance */

  private stanceParams: StanceParams = { ...DEFAULT_STANCE };
  /** 0..1 while the lead hand is tapping or pulling his head (read by the opponent). */
  headTapW = 0;
  /** 0..1 while the lead hand paws at his hands in stance (read by the opponent, who swats it). */
  pawW = 0;
  /** Lead leg as a blend, -1..1, so a stance switch flows over half a second instead of snapping. */
  private leadBlend = 1;
  private stanceAlt: LocalPose = createLocal();

  private buildStance(v: Extract<AnimView, { mode: 'stance' }>, opp: Animator | null): void {
    const s = this.stanceParams;
    const c = Math.cos(v.yaw);
    const sn = Math.sin(v.yaw);
    // Velocity in the body frame: lateral motion shifts the weight.
    const lateral = v.vx * c - v.vz * sn;
    const forward = v.vx * sn + v.vz * c;
    this.breath += Math.min(0.05, this.frameDt) * (2.1 + v.exertion * 2.4 + (1 - v.stamina) * 2);
    s.level = v.relaxed ? 0.95 : Math.max(0.1, Math.min(0.8, v.level + this.character.motion.levelOffset));
    // Blend a lead switch over about half a second.
    if (this.instant) this.leadBlend = v.lead;
    else {
      const step = Math.min(0.05, this.frameDt) / 0.22;
      this.leadBlend += Math.max(-step, Math.min(step, v.lead - this.leadBlend));
    }
    const effLead: 1 | -1 = this.leadBlend >= 0 ? 1 : -1;
    s.lead = effLead;
    s.lean = Math.max(-1, Math.min(1, v.lean + forward * 0.08));
    const settle = v.relaxed || v.act !== 'stance' ? 0 : 1;
    // Livelier (owner, November 11: "Yes, liven stance", after "more explosive and athletic"): the weight shift and
    // level pulse run about 40% quicker and a little bigger than the slow sway (rhythm 1.7, side 0.16, level 0.013).
    const rhythm = this.time * 2.4 * this.character.motion.tempo + this.seed;
    const bounce = this.character.motion.bounce ?? 1;
    s.side = Math.max(-1, Math.min(1, lateral * 0.35 + Math.sin(rhythm) * 0.2 * settle * bounce));
    s.level += Math.sin(rhythm * 0.71) * 0.02 * settle * bounce;
    // A rock between the front and back foot while set, never still.
    s.lean = Math.max(-1, Math.min(1, s.lean + Math.sin(rhythm * 0.43 + 1.1) * 0.22 * settle * bounce));
    s.phase = this.breath;
    s.fatigue = 1 - v.stamina;
    s.width = v.relaxed ? 0.75 : this.character.motion.stanceWidth;
    s.guard = v.relaxed ? 0 : 1;
    s.stagger = v.relaxed ? 0.6 : this.character.motion.stagger ?? 1;
    s.handHeight = this.character.motion.handHeight ?? 0;
    if (Math.abs(this.leadBlend) >= 0.999) stancePose(s, this.local);
    else {
      s.lead = 1;
      stancePose(s, this.local);
      s.lead = -1;
      stancePose(s, this.stanceAlt);
      const w = (1 - this.leadBlend) / 2;
      for (let i = 0; i < this.local.length; i++) this.local[i] += (this.stanceAlt[i] - this.local[i]) * w;
      s.lead = effLead;
    }

    const lp = this.local;
    const u = v.actDur > 0 && Number.isFinite(v.actDur) ? Math.min(1, v.actT / v.actDur) : 0;
    // Attacking actions (fakes, snaps, reaches, attempts) burst in and recover slower, peaking at 30% of the act
    // (owner, November 11: "more explosive and athletic"). The symmetric bell eased in as slowly as it eased out.
    // Smoothstep on each side keeps the start, peak and end at rest, so nothing snaps.
    const burstK = u < 0.3 ? u / 0.3 : (1 - u) / 0.7;
    const burstCurve = burstK * burstK * (3 - 2 * burstK);
    const attacking = v.act === 'snap' || v.act === 'fake' || v.act === 'reach' || v.act === 'attackAttempt';
    const bell = attacking ? burstCurve : Math.sin(u * Math.PI);
    const leadHand = effLead === 1 ? P.HAND_L : P.HAND_R;

    if (v.relaxed) {
      // Hands on the hips, chest up, breathing.
      lp[P.HAND_L] = 0.19;
      lp[P.HAND_L + 1] = lp[P.HIPS + 1] + 0.1;
      lp[P.HAND_L + 2] = 0.0;
      lp[P.HAND_R] = -0.19;
      lp[P.HAND_R + 1] = lp[P.HIPS + 1] + 0.1;
      lp[P.HAND_R + 2] = 0.0;
      lp[P.ELBOW_L] = 0.6;
      lp[P.ELBOW_L + 1] = lp[P.HIPS + 1] + 0.3;
      lp[P.ELBOW_L + 2] = -0.2;
      lp[P.ELBOW_R] = -0.6;
      lp[P.ELBOW_R + 1] = lp[P.HIPS + 1] + 0.3;
      lp[P.ELBOW_R + 2] = -0.2;
      lp[P.WRIST_L] = 0.5;
      lp[P.WRIST_R] = 0.5;
      lp[P.SPINE] += (1 - v.stamina) * 0.25;
      lp[P.HEAD] = 0.05;
      if (v.shake && opp) {
        // Right hand out to the middle, a couple of firm pumps.
        const gap = this.distanceTo(opp, v.x, v.z);
        lp[P.HAND_R] = -0.04;
        lp[P.HAND_R + 1] = 0.98 + Math.sin(this.time * 11) * 0.025;
        lp[P.HAND_R + 2] = gap / 2 - 0.02;
        lp[P.ELBOW_R] = -0.4;
        lp[P.ELBOW_R + 1] = 0.8;
        lp[P.ELBOW_R + 2] = -0.2;
        lp[P.WRIST_R] = 0;
        lp[P.WRIST_R + 2] = 1.2;
        lp[P.SPINE] += 0.08;
      }
    } else if (v.act === 'reach') {
      lp[leadHand + 2] += 0.26 * bell;
      lp[leadHand + 1] += 0.06 * bell;
      lp[P.SPINE] += 0.08 * bell;
    } else if (v.act === 'snap') {
      // Hips sink, hands rip down toward the mat.
      lp[P.HIPS + 1] -= 0.1 * bell;
      lp[P.SPINE] += 0.3 * bell;
      lp[P.HAND_L + 1] -= 0.28 * bell;
      lp[P.HAND_R + 1] -= 0.28 * bell;
      lp[P.HAND_L + 2] -= 0.05 * bell;
      lp[P.HAND_R + 2] -= 0.05 * bell;
    } else if (v.act === 'attackAttempt') {
      // An entry without a secure tie still visibly tries its own technique.
      // Keep it local: an out-of-range attempt must not teleport the opponent.
      const move = v.attemptedTechnique;
      if (move === 'slideBy') {
        lp[P.SPINE + 1] += .28 * bell;
        lp[P.HAND_L] += .20 * bell; lp[P.HAND_R] += .20 * bell;
        lp[P.HAND_L + 2] -= .12 * bell; lp[P.HAND_R + 2] -= .12 * bell;
      } else if (move === 'footSweep') {
        lp[P.FOOT_R + 2] += .24 * bell; lp[P.FOOT_R + 1] += .055 * bell;
        lp[P.HAND_L + 2] -= .12 * bell; lp[P.SPINE + 2] += .08 * bell;
      } else {
        const depth = move === 'superDuck' ? .23 : move === 'firemansCarry' ? .19 : .13;
        lp[P.HIPS + 1] -= depth * bell;
        lp[P.SPINE] += .15 * bell;
        lp[P.HEAD] += .15 * bell;
        lp[P.HAND_L + 1] += (move === 'firemansCarry' ? -.20 : .15) * bell;
        lp[P.HAND_R + 2] += .15 * bell;
        lp[P.SPINE + 1] += (move === 'firemansCarry' ? -.3 : .2) * bell;
      }
    } else if (v.act === 'fake') {
      lp[P.HIPS + 1] -= 0.14 * bell;
      lp[P.HIPS + 2] += 0.05 * bell;
      lp[P.SPINE] += 0.12 * bell;
      lp[P.HAND_L + 1] -= 0.16 * bell;
      lp[P.HAND_R + 1] -= 0.16 * bell;
      lp[P.HEAD] += 0.2 * bell;
    } else if (v.act === 'sprawl' || v.act === 'sprawlRecover') {
      // In neutral there is never a shot under him: a real shot moves the bout to the legs position, where
      // the paired clip does the full sprawl. Here it is a bite on a fake or a read, so a down block that
      // keeps him on his feet (it was the full sprawl to the mat, which looked like a dive at nothing).
      const ramp = v.act === 'sprawl' ? Math.min(1, u * 3.2) : 1 - u;
      downBlock(lp, ramp * ramp * (3 - 2 * ramp));
    } else if (v.act === 'swim') {
      // Pummel: the shoulder turns in and dips as the arm swims under his.
      lp[P.SPINE + 1] += 0.22 * bell * (effLead === 1 ? 1 : -1);
      lp[P.SPINE] += 0.06 * bell;
      lp[P.HIPS + 1] -= 0.03 * bell;
    } else if (v.act === 'stagger') {
      lp[P.SPINE] += 0.25 * bell;
      lp[P.HIPS + 1] -= 0.05 * bell;
      lp[P.HAND_L] += 0.12 * bell;
      lp[P.HAND_R] -= 0.12 * bell;
      lp[P.HAND_L + 1] -= 0.1 * bell;
      lp[P.HAND_R + 1] -= 0.1 * bell;
    }

    // Live hands: small, quick, always working when he is in range.
    const close = opp ? this.distanceTo(opp, v.x, v.z) : 9;
    const engaged = !v.relaxed && close < 1.4;
    if (engaged && v.act === 'stance') {
      const t = this.time * this.character.motion.tempo + this.seed;
      const amp = (0.016 + (close < 1.1 ? 0.012 : 0)) * this.character.motion.handActivity;
      lp[P.HAND_L] += Math.sin(t * 5.3) * amp * 0.6;
      lp[P.HAND_L + 1] += Math.sin(t * 6.7 + 1) * amp;
      lp[P.HAND_L + 2] += Math.sin(t * 4.1 + 2) * amp * 1.4;
      lp[P.HAND_R] += Math.sin(t * 4.9 + 3) * amp * 0.6;
      lp[P.HAND_R + 1] += Math.sin(t * 6.1 + 4) * amp;
      lp[P.HAND_R + 2] += Math.sin(t * 4.6 + 5) * amp * 1.4;
    }
    // Livelier stance (owner, November 11): a small knee pump, quick paws at his hands and short level changes, each
    // a burst in and slower recovery. Paws are answered: the other man's lead hand swats across (see pawW below).
    this.pawW = 0;
    if (!v.relaxed && v.act === 'stance') {
      const bounceAmt = this.character.motion.bounce ?? 1;
      lp[P.HIPS + 1] += Math.sin(this.time * 11.5 * this.character.motion.tempo + this.seed * 3) * 0.006 * bounceAmt;
      if (engaged) {
        const t = this.time * this.character.motion.tempo + this.seed;
        const hash = (k: number) => { const x = Math.sin(k * 12.9898 + this.seed * 78.233) * 43758.5453; return x - Math.floor(x); };
        const pulse = (period: number, len: number, chance: number, salt: number) => {
          const k = Math.floor(t / period), local = t - k * period;
          if (local >= len || hash(k + salt) >= chance) return 0;
          const q = local / len, kk = q < 0.3 ? q / 0.3 : (1 - q) / 0.7;
          return kk * kk * (3 - 2 * kk);
        };
        const paw = pulse(1.5, 0.34, 0.5 * this.character.motion.handActivity, 0);
        this.pawW = paw;
        lp[leadHand + 2] += 0.13 * paw;
        lp[leadHand + 1] -= 0.04 * paw;
        lp[P.SPINE + 1] += 0.08 * paw * (effLead === 1 ? -1 : 1);
        const dip = pulse(2.3, 0.4, 0.42, 17);
        lp[P.HIPS + 1] -= 0.045 * dip;
        lp[P.SPINE] += 0.05 * dip;
        lp[P.HAND_L + 1] -= 0.035 * dip;
        lp[P.HAND_R + 1] -= 0.035 * dip;
      }
      // His paw at my hands: my lead hand swats it down and across.
      const swat = opp && engaged ? opp.pawW : 0;
      lp[leadHand] -= 0.05 * swat * effLead;
      lp[leadHand + 1] -= 0.03 * swat;
      lp[leadHand + 2] += 0.04 * swat;
    }
    // A reach is a head tap or pull, and a fake in range taps too: lead hand to the back of
    // his head, with a small lean and dip to sell it. The sim makes him answer it.
    this.headTapW = !v.relaxed && close < 1.3 && v.hand < 0.62 && (v.act === 'reach' || v.act === 'fake') ? bell : 0;
    lp[P.SPINE] += 0.07 * this.headTapW;
    lp[P.HIPS + 1] -= 0.02 * this.headTapW;
    // His answers. A bite: the head and hips come up. A swat or a wrist tie turns the shoulders into it.
    if (v.act === 'headUp') {
      lp[P.HEAD] -= 0.3 * bell;
      lp[P.SPINE] -= 0.12 * bell;
    }
    if (v.act === 'swat' || v.act === 'tieArm') lp[P.SPINE + 1] += 0.12 * bell * (v.lead === 1 ? -1 : 1);
    // His tap on my head dips it.
    const tapped = opp && !v.relaxed ? opp.headTapW : 0;
    lp[P.HEAD] += 0.2 * tapped;
    lp[P.SPINE] += 0.05 * tapped;
    // His collar tie on me pulls my head down, in pulses rather than a fixed hold.
    if (v.oppHand >= 0.62 && v.oppTie !== 'underhook' && v.oppTie !== 'bodyLock' && !v.relaxed) {
      const pull = 0.6 + 0.4 * Math.max(0, Math.sin(this.time * 2.3 + this.seed));
      lp[P.SPINE] += 0.1 * pull;
      lp[P.HEAD] += 0.12 * pull + 0.06 * Math.max(0, Math.sin(this.time * 2.3 + this.seed));
    }
    // Tied up: heads meet, hips stay back.
    if (!v.relaxed && close < 0.95) {
      const tie = Math.min(1, (0.95 - close) / 0.25);
      lp[P.SPINE] += 0.16 * tie;
      lp[P.HIPS + 2] -= 0.06 * tie;
      lp[P.HEAD] -= 0.1 * tie;
      // Heads go beside each other, cheek to cheek on the shoulder, as in a real tie, not head-on into
      // the chest (owner: heads passing through bodies "like a ghost"). Each bends to his own side, so the
      // two heads pass. Frames with a head over 5 cm inside the other man in stance: 6,656 -> 1,184 of
      // 331,169 over 24 AI matches.
      lp[P.SPINE + 2] += 0.35 * tie;
      lp[P.HEAD + 2] += 0.28 * tie;
      // Closer still (hips under 0.84 m apart, full at the 0.68 m minimum gap): chest up, hips back and the head further to the side, since
      // leaning in there put the head inside his chest (owner, November 10: fluidity and realism).
      const chestUp = Math.max(0, Math.min(1, (0.84 - close) / 0.16));
      lp[P.SPINE] -= 0.24 * chestUp;
      lp[P.HIPS + 2] -= 0.1 * chestUp;
      lp[P.SPINE + 2] += 0.24 * chestUp;
    }

    scaleLocal(lp, this.scale);
    const frame = { x: v.x, z: v.z, yaw: v.yaw };
    localToWorld(lp, frame, this.target);
    // The stance's own feet are where footwork aims.
    this.feetDesired.set(this.target);
    this.lookAtOpponent(opp, 0.85);

    if (v.shake && opp) this.contacts.push({ hand: 'R', on: 'handR', at: [0, -0.03, 0.02], weight: 0.55 });

    // Hands: ties become grips on the other body; without a tie they still go
    // looking for his wrists, so hands meet hands instead of passing through.
    const gripsFrom = this.contacts.length;
    if (opp && !v.relaxed && close < 1.3 && v.act !== 'sprawl' && v.act !== 'sprawlRecover') {
      const myLead: 'L' | 'R' = effLead === 1 ? 'L' : 'R';
      const myRear: 'L' | 'R' = myLead === 'L' ? 'R' : 'L';
      const opposite = (h: 'L' | 'R'): 'L' | 'R' => (h === 'L' ? 'R' : 'L');
      const t = this.time * this.character.motion.tempo + this.seed;
      if (this.headTapW > 0.02) {
        this.contacts.push({ hand: myLead, on: 'head', at: [0, 0.06, -0.07], weight: this.headTapW });
      }
      // Swat the tapping arm away, or catch its wrist.
      if (v.act === 'swat') this.contacts.push({ hand: myRear, on: `forearm${opposite(myRear)}` as BoneName, at: [0, -0.14, 0.03], weight: bell });
      if (v.act === 'tieArm') this.contacts.push({ hand: myLead, on: `hand${opposite(myLead)}` as BoneName, at: [0, 0.0, 0.03], weight: Math.min(1, u * 3) });
      if (v.hand >= 0.62 && v.tie === 'bodyLock') {
        // Body lock: both arms under his, hands clasped behind his back, chest to chest.
        this.contacts.push({ hand: 'L', on: 'spine', at: [0.04, 0.0, -0.13], weight: 1 });
        this.contacts.push({ hand: 'R', on: 'spine', at: [-0.04, 0.0, -0.13], weight: 1 });
      } else if (v.act === 'swim') {
        // Pummel: the swimming hand goes in under his arm to the shoulder blade, the other stays on him.
        this.contacts.push({ hand: myRear, on: 'chest', at: [myRear === 'L' ? -0.12 : 0.12, 0.1, -0.1], weight: bell });
        this.contacts.push({ hand: myLead, on: `forearm${opposite(myLead)}` as BoneName, at: [0, -0.1, 0.02], weight: 0.7 });
      } else if (v.hand >= 0.62 && v.tie === 'underhook') {
        // Underhook: the lead arm goes under his arm, hand flat on the shoulder blade;
        // the other hand holds his wrist (reference cna5d3Bg5Ik, 0:25 to 0:34).
        this.contacts.push({ hand: myLead, on: 'chest', at: [myLead === 'L' ? -0.12 : 0.12, 0.1, -0.1], weight: 1 });
        this.contacts.push({ hand: myRear, on: `forearm${opposite(myRear)}` as BoneName, at: [0, -0.1, 0.02], weight: 0.9 });
      } else if (v.hand >= 0.62) {
        this.contacts.push({ hand: myLead, on: 'neck', at: [0, 0.045, -0.07], weight: 1 });
        this.contacts.push({ hand: myRear, on: `forearm${opposite(myRear)}` as BoneName, at: [0, -0.1, 0.02], weight: 0.9 });
      } else if (v.hand >= 0.3) {
        this.contacts.push({ hand: myLead, on: `forearm${opposite(myLead)}` as BoneName, at: [0, -0.2, 0.02], weight: 0.95 * (1 - this.headTapW) });
        this.contacts.push({ hand: myRear, on: `hand${opposite(myRear)}` as BoneName, at: [0, 0.0, 0.03], weight: 0.35 + 0.3 * Math.sin(t * 3.1) ** 2 });
      } else if (v.oppHand < 0.3 && close < 1.2) {
        // Fighting for inside position: reach, touch, pull back.
        const reachLead = v.act === 'reach' ? 1 : 0.3 + 0.45 * Math.max(0, Math.sin(t * 2.6));
        const reachRear = 0.2 + 0.4 * Math.max(0, Math.sin(t * 2.1 + 1.7));
        this.contacts.push({ hand: myLead, on: `forearm${opposite(myLead)}` as BoneName, at: [0, -0.22, 0.03], weight: reachLead * (1 - this.headTapW) });
        this.contacts.push({ hand: myRear, on: `forearm${opposite(myRear)}` as BoneName, at: [0, -0.18, 0.03], weight: reachRear });
      } else if (v.act === 'reach') {
        this.contacts.push({ hand: myLead, on: 'neck', at: [0, 0.05, -0.05], weight: Math.sin(u * Math.PI) });
      }
    }
    // Mid-switch the hands trade roles: fade the grips through the middle so neither jumps.
    for (let i = gripsFrom; i < this.contacts.length; i++) this.contacts[i].weight *= Math.abs(this.leadBlend);
  }

  private distanceTo(opp: Animator, x: number, z: number): number {
    const h = opp.character.bones.hips.position;
    return Math.hypot(h.x - x, h.z - z);
  }

  private lookAtOpponent(opp: Animator | null, weight: number): void {
    if (!opp) {
      this.target[P.LOOK_W] = 0;
      return;
    }
    opp.headPos(_v2);
    this.target[P.LOOK] = _v2.x;
    this.target[P.LOOK + 1] = _v2.y - 0.05;
    this.target[P.LOOK + 2] = _v2.z;
    this.target[P.LOOK_W] = weight;
  }

  /* ----------------------------------------------------------------- walk */

  private buildWalk(v: Extract<AnimView, { mode: 'walk' }>, opp: Animator | null): void {
    const s = this.stanceParams;
    this.breath += this.frameDt * 2;
    Object.assign(s, DEFAULT_STANCE, { level: 0.97, width: 0.62, guard: 0, phase: this.breath, lead: 1 });
    stancePose(s, this.local);
    const lp = this.local;
    // Release the low wrestling-ready knee bend when standing or strolling.
    // Keep the existing lower pelvis at brisk speed for trailing-leg reach;
    // the posture spring blends starts/stops rather than snapping the knees.
    const travel = Math.min(1, Math.hypot(v.vx, v.vz) / (this.scale * .65));
    const strideLoad = travel * travel * (3 - 2 * travel);
    lp[P.HIPS + 1] += .03 * (1 - strideLoad);
    // Upright walk: feet side by side, arms swinging opposite the legs.
    lp[P.FOOT_L] = .10;
    lp[P.FOOT_R] = -.10;
    lp[P.FOOT_L + 2] = 0;
    lp[P.FOOT_R + 2] = 0;
    // Walking knees track straight ahead of their own hip, rather than using
    // the staggered/outward poles authored for a defensive wrestling stance.
    for (const [at, side] of [[P.KNEE_L, 1], [P.KNEE_R, -1]] as const) {
      lp[at] = .10 * side;
      lp[at + 1] = .45;
      lp[at + 2] = .75;
    }
    lp[P.FOOT_L + FOOT.YAW] = 0.08;
    lp[P.FOOT_R + FOOT.YAW] = -0.08;
    lp[P.FOOT_L + FOOT.HEEL] = 0;
    lp[P.FOOT_R + FOOT.HEEL] = 0;
    lp[P.HIPS_Q] = 0;
    lp[P.HIPS_Q + 1] = 0.04;
    lp[P.SPINE] = 0.04;
    lp[P.SPINE + 1] = 0;
    lp[P.HEAD] = -0.05;
    lp[P.HAND_L] = 0.2;
    lp[P.HAND_L + 1] = 0.82;
    lp[P.HAND_L + 2] = 0.02;
    lp[P.HAND_R] = -0.2;
    lp[P.HAND_R + 1] = 0.82;
    lp[P.HAND_R + 2] = 0.02;
    lp[P.ELBOW_L] = 0.35;
    lp[P.ELBOW_L + 1] = 1.0;
    lp[P.ELBOW_L + 2] = -0.4;
    lp[P.ELBOW_R] = -0.35;
    lp[P.ELBOW_R + 1] = 1.0;
    lp[P.ELBOW_R + 2] = -0.4;
    lp[P.WRIST_L] = 0;
    lp[P.WRIST_R] = 0;
    lp[P.WRIST_L + 2] = 0;
    lp[P.WRIST_R + 2] = 0;
    // Running back to the center (owner): lean into it, elbows bent near 90 degrees, hands up by the ribs; the
    // arm swing itself grows with the stride (below).
    const speed = Math.hypot(v.vx, v.vz) / this.scale;
    const run = Math.max(0, Math.min(1, (speed - 1.4) / 1.2));
    this.walkRun += (run - this.walkRun) * Math.min(1, this.frameDt * 6);
    const r = this.walkRun;
    if (r > 0.001) {
      lp[P.SPINE] += 0.22 * r;
      lp[P.HIPS_Q + 1] += 0.08 * r;
      lp[P.HEAD] -= 0.12 * r;
      lp[P.HIPS + 1] -= 0.035 * r;
      for (const [hand, elbow, side] of [[P.HAND_L, P.ELBOW_L, 1], [P.HAND_R, P.ELBOW_R, -1]] as const) {
        lp[hand] += (0.17 * side - lp[hand]) * r;
        lp[hand + 1] += (1.02 - lp[hand + 1]) * r;
        lp[hand + 2] += (0.12 - lp[hand + 2]) * r;
        lp[elbow] += (0.5 * side - lp[elbow]) * r;
        lp[elbow + 1] += (-0.3 - lp[elbow + 1]) * r;
        lp[elbow + 2] += (-0.7 - lp[elbow + 2]) * r;
      }
    }
    // Gassed after a long scramble: hands on the hips, elbows out, head and chest down (walking it, not running).
    const tired = Math.max(0, Math.min(1, (0.45 - v.stamina) / 0.3)) * (1 - r);
    this.walkTired += (tired - this.walkTired) * Math.min(1, this.frameDt * 3);
    const k = this.walkTired;
    if (k > 0.001) {
      const mix = (at: number, value: number) => { lp[at] += (value - lp[at]) * k; };
      mix(P.HAND_L, 0.2); mix(P.HAND_L + 1, 1.0); mix(P.HAND_L + 2, 0.0);
      mix(P.HAND_R, -0.2); mix(P.HAND_R + 1, 1.0); mix(P.HAND_R + 2, 0.0);
      mix(P.ELBOW_L, 1.0); mix(P.ELBOW_L + 1, 0.1); mix(P.ELBOW_L + 2, -0.25);
      mix(P.ELBOW_R, -1.0); mix(P.ELBOW_R + 1, 0.1); mix(P.ELBOW_R + 2, -0.25);
      lp[P.HEAD] += 0.3 * k;
      lp[P.SPINE] += 0.1 * k;
    }
    scaleLocal(lp, this.scale);
    localToWorld(lp, { x: v.x, z: v.z, yaw: v.yaw }, this.target);
    this.feetDesired.set(this.target);
    this.lookAtOpponent(opp, opp ? 0.3 : 0);
  }

  /* --------------------------------------------------------------- paired */

  /** Base is hit and rebuilt press by press; the body follows smoothly, not in jerks. */
  private rideProgress = 0;
  /** Smoothed hand control on the ride (bottom man), 0..1. */
  private handControl = 0;
  private wasRiding = false;
  private easedRideProgress(v: Extract<AnimView, { mode: 'paired' }>): number {
    const riding = v.clip === 'ride';
    if (!riding || !this.wasRiding || this.instant) this.rideProgress = v.progress;
    else this.rideProgress += (v.progress - this.rideProgress) * Math.min(1, this.frameDt * 5);
    this.wasRiding = riding;
    return this.rideProgress;
  }

  private buildPaired(v: Extract<AnimView, { mode: 'paired' }>, opp: Animator | null): void {
    const lp = this.local;
    const smoothGuide=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
    this.barGuideHand=v.mirror?'R':'L';
    this.barGuideWeight=v.role!=='A'?0:v.clip==='armBarSupportedSeatedTurnDraft'?smoothGuide((v.u-.5)/.12):v.clip==='armBarSupportedSeatedFinishDraft'?1:v.clip==='armBarSupportedSeatedExitDraft'?smoothGuide((.3-v.u)/.3):0;
    const contacts = v.hold
      ? sampleHold(v.clip, v.role, this.easedRideProgress(v), (this.phase += this.frameDt), v.intensity, v.mirror, lp)
      : sampleMove(v.clip, v.role, v.u, v.mirror, lp);
    if(!v.hold && v.clip==='armBarSupportedSeatedExitDraft'){
 const list=(moveClip(v.clip)?.contacts??[]).filter(c=>c.who===v.role);
 for(const side of ['L','R'] as const){
  const canonical=v.mirror?(side==='L'?'R':'L'):side;
  const own=list.filter(c=>c.hand===canonical);
  const index=own.findIndex(c=>v.u>(c.from??0)-(c.fade??.06)&&v.u<(c.to??1)+(c.fade??.06));
  if(index<0){this.phaseContactStart[side]=0;continue;}
  const c=own[index],fade=c.fade??.06,from=c.from??0;
  let start=Math.max(0,from-fade);
  for(const prior of own.slice(0,index)){
   const lo=(prior.from??0)-(prior.fade??.06),hi=(prior.to??1)+(prior.fade??.06);
   if(lo<=start && hi>start)start=hi;
  }
  this.phaseContactStart[side]=Math.max(0,Math.min(1,1-(from-start)/fade));
 }
}
if(!v.hold && v.role==='A')applyArmBarTurnSteps(lp,v.clip,v.u,v.mirror);
    if(v.role==='A'&&!v.hold&&/^(armBar|wristBar|barHalf|doubleBar)Resisted$/.test(v.clip)&&this.scale<1){
      // Pair contacts share a common frame, but a smaller rider cannot reach
      // the same wide foot base. Bring supports toward the pelvis without
      // moving the hips away from the opponent or raising the mat targets.
      // Use a fixed pressure-base center so hip motion cannot drag supports.
      const ramp=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
      const reach=1-(1-this.scale)*ramp(v.u/.2)*ramp((1-v.u)/.2);
      for(const at of [P.FOOT_L,P.FOOT_R,P.KNEE_L,P.KNEE_R]){
        for(const axis of [0,2]){
          const anchor=axis===0?.33*(v.mirror?-1:1):-.07;
          lp[at+axis]=anchor+(lp[at+axis]-anchor)*reach;
        }
      }
    }

    if(!v.hold&&v.role==='B'&&v.clip==='barHalfTurn'&&v.u>=.38){
      // Recover only after the bar clears; spline anticipation can otherwise
      // pull the arm forward while the rider still has its forearm secured.
      const t=Math.max(0,Math.min(1,(v.u-.56)/.44)),k=t*t*(3-2*t),sign=v.mirror?-1:1;
      const hand=v.mirror?P.HAND_R:P.HAND_L,elbow=v.mirror?P.ELBOW_R:P.ELBOW_L;
      for(const [at,start,end] of [[hand,[.13,.29,.18],[.28,.16,.43]],[elbow,[.34,.20,.40],[.38,.12,.30]]] as const){
        for(let axis=0;axis<3;axis++)lp[at+axis]=(start[axis]+(end[axis]-start[axis])*k)*(axis===0?sign:1);
      }
    }
    if(v.role==='B')applyDoubleBarDefender(lp,v.clip,v.u,v.hold,v.mirror);
    this.contacts = contacts;
    this.footContacts = sampleFootContacts(v.clip,v.role,v.hold?v.progress:v.u,v.mirror,v.hold);
    if(v.hold && (v.clip==='legRide' || v.clip==='legRideFlat') && v.role==='B') {
      // Keep the opposite palm posted while sealing the threatened hip pocket.
      // The rider's wrist follows this forearm through normal contact closure.
      const closure=Math.max(0,Math.min(1,v.pockets??0));
      const hand=v.mirror?P.HAND_R:P.HAND_L;
      const elbow=v.mirror?P.ELBOW_R:P.ELBOW_L;
      const side=v.mirror?-1:1;
      const blend=closure*closure*(3-2*closure);
      const flat=v.clip==='legRideFlat';
      const handTarget=flat?[side*.12,.07,.4]:[side*.12,.28,.16];
      const elbowTarget=flat?[side*.16,.1,.22]:[side*.17,.3,-.02];
      for(let axis=0;axis<3;axis++) {
        lp[hand+axis]+=(handTarget[axis]-lp[hand+axis])*blend;
        lp[elbow+axis]+=(elbowTarget[axis]-lp[elbow+axis])*blend;
      }
    }
    this.handControl += ((v.hold && v.clip==='ride' && v.role==='B' ? v.hands ?? 0 : 0) - this.handControl) * Math.min(1, this.frameDt * 6);
    if(v.hold && v.clip==='ride' && v.role==='B' && this.handControl > 0.01){
      // Hand control (owner, November 10: stand-ups and sit-outs work off hand control): the free hand comes off the
      // mat and takes the rider's wrist at the near hip, the far post carrying his weight.
      const k=Math.min(1,this.handControl/0.6), blend=k*k*(3-2*k), side=v.mirror?-1:1;
      const hand=v.mirror?P.HAND_L:P.HAND_R, elbow=v.mirror?P.ELBOW_L:P.ELBOW_R;
      const handTarget=[side*.02,.34,.02], elbowTarget=[side*-.2,.42,.14];
      for(let axis=0;axis<3;axis++){
        lp[hand+axis]+=(handTarget[axis]-lp[hand+axis])*blend;
        lp[elbow+axis]+=(elbowTarget[axis]-lp[elbow+axis])*blend;
      }
    }
    if(v.hold && v.clip==='cradleHold' && v.role==='B'){
      // Push the trapped foot away to lengthen the folded leg while both
      // hands remain on the top wrestler's grip through contact closure.
      const resistance=Math.max(0,Math.min(1,v.resistance??0));
      const foot=v.mirror?P.FOOT_R:P.FOOT_L;
      lp[foot+2]-=.025*resistance;
      lp[foot+1]+=.012*resistance;
    }
    if(v.hold && isArmBarPin(v.clip))applyArmBarResistance(lp,v.role==='A',v.resistance??0,v.mirror,v.clip==='armBarSupportedSeatedFinishDraft',this.scale);
    const failedRise = v.clip === 'ride' && this.effortPulse.button === 'shoot' && this.effortPulse.result === 'lost'
      && (v.role === 'B' ? !this.effortPulse.reaction : this.effortPulse.reaction);
    // Owner, November 10: with him on his back the top man adjusts and drives him deeper. A squeeze that tightens
    // the hold ('won' on a pin) is a bigger, slower pulse than an ordinary squeeze.
    const tighten = this.effortPulse.result === 'won' && ['exposed','cradleHold','spladle'].includes(v.clip) && !isArmBarPin(v.clip);
    // The top man's chop on the ride is its own quick strike (CHOP), seen by both men.
    const chop = (v.clip === 'ride' || v.clip === 'flat') && this.effortPulse.button === 'fight' && (v.role === 'A' ? !this.effortPulse.reaction : this.effortPulse.reaction);
    const effortDuration = failedRise ? 0.9 : tighten ? 0.62 : chop ? CHOP.duration : 0.42;
    if (v.hold && this.effortPulse.age < effortDuration) {
      // Local paired motion happens before IK/contact closure: locked hands stay
      // attached while the trunk, head and controlled limbs actually yield.
      const pulse = effortEnvelope(this.effortPulse.age, effortDuration);
      const reaction = this.effortPulse.reaction;
      const amount = pulse * (reaction ? 0.5 : 1) * (0.65 + 0.35 * v.stamina) * (tighten ? 1.8 : 1);
      const top = v.role === 'A';
      const pin = ['exposed','cradleHold','spladle'].includes(v.clip);
      if(applyArmBarEffort(lp,v.clip,top,reaction,this.effortPulse.button,amount,v.mirror,v.resistance??0,this.scale,pulse*(.65+.35*v.stamina))){
        // Bar-specific pressure and defensive bridge; contacts close below.
        if(v.clip==='armBarPin'&&!top&&!reaction){
          // The free hand fights near the wrist of the controlling forearm.
          // Follow that arm through the bridge rather than reaching into air.
          const smooth=(t:number)=>{const k=Math.max(0,Math.min(1,t));return k*k*(3-2*k);};
          const reach=smooth(this.effortPulse.age/.14)*(1-smooth((this.effortPulse.age-.28)/.14));
          this.contacts=[...contacts,{hand:v.mirror?'L':'R',on:v.mirror?'forearmR':'forearmL',
            at:[0,-.22,.045],weight:reach,palm:true}];
        }
        if(v.clip==='barHalfPin'&&!top&&!reaction){
          // The freed bar-side hand peels at the half's forearm. This follows
          // the already-posed controlling arm rather than a fixed air target.
          this.contacts=[...contacts,{hand:v.mirror?'R':'L',on:v.mirror?'forearmL':'forearmR',
            at:[0,-.16,.045],weight:pulse}];
        }
      } else if (pin) {
        if (top) {
          lp[P.SPINE] += 0.12 * amount;
          lp[P.ELBOW_L] += 0.045 * amount;
          lp[P.ELBOW_R] -= 0.045 * amount;
          lp[P.HIPS + 1] -= 0.025 * amount;
        } else {
          lp[P.HIPS + 1] += (reaction ? 0.02 : 0.075) * amount;
          lp[P.SPINE + 2] += 0.12 * amount;
          lp[P.HEAD] += 0.08 * amount;
          const freeFoot=v.mirror?P.FOOT_L:P.FOOT_R;
          lp[freeFoot + 2] -= 0.12 * amount;
          if(v.clip==='cradleHold' && !reaction){
            const trappedFoot=v.mirror?P.FOOT_R:P.FOOT_L;
            lp[trappedFoot+2]-=.012*amount;
          }
        }
      } else if (applyLegEffort(lp, v.clip, top, reaction, this.effortPulse.button, amount, v.mirror)) {
        // Leg-specific paired response; existing contacts close below.
      } else if (chop) {
        const c = chopCurve(this.effortPulse.age);
        const k = 0.65 + 0.35 * v.stamina;
        // Already flat, he gives less: the arm is knocked back, the chest is already down.
        applyChop(lp, top, c.lift * k, c.strike * k * (top || v.clip === 'ride' ? 1 : 0.45), v.mirror);
        // The striking hand leaves his arm on the lift and lands back on it with the strike.
        if (top) {
          const striking = v.mirror ? 'R' : 'L';
          for (const contact of this.contacts) if (contact.hand === striking) contact.weight *= 1 - 0.9 * c.lift;
        }
      } else if (v.clip === 'ride') {
        applyRideEffort(lp, top, reaction, this.effortPulse.button, amount, v.mirror, failedRise);
      } else if (v.clip === 'flat') {
        const rise = !top && !reaction;
        lp[P.HIPS + 1] += (rise ? 0.10 : -0.025) * amount;
        lp[P.SPINE] += (rise ? -0.18 : 0.12) * amount;
        lp[P.ELBOW_L + 2] -= 0.06 * amount;
        lp[P.ELBOW_R + 2] -= 0.06 * amount;
        if (rise && this.effortPulse.button === 'fight') lp[P.SPINE + 1] += 0.20 * amount;
      } else {
        lp[P.SPINE] += (top ? 0.12 : -0.10) * amount;
        lp[P.HEAD] += (v.clip === 'fhl' ? 0.16 : 0.06) * amount;
        lp[P.ELBOW_L + 2] -= 0.07 * amount;
        lp[P.ELBOW_R + 2] -= 0.07 * amount;
      }
    }

    // The folded back exposure is authored from the mat upward. Taller
    // skeletons need matching pelvis clearance so the head does not penetrate
    // the mat. Blend that floor clearance into the roll's landing as well.
    if (v.clip === 'spladle' && v.role === 'B') lp[P.HIPS + 1] *= this.scale;
    else if (v.clip === 'spladleCounter' && v.role === 'A') {
      const landing = Math.max(0, Math.min(1, (v.u - .5) * 2));
      const blend = landing * landing * (3 - 2 * landing);
      lp[P.HIPS + 1] += .37 * (this.scale - 1) * blend;
    }

    // Shots start from wherever the bodies really were: close the gap to the
    // authored contact over the first part of the move.
    const clip = !v.hold ? moveClip(v.clip) : undefined;
    if (clip?.startDist && v.dist !== undefined) {
      const k = Math.min(1, v.u / (clip.warpBy ?? 0.55));
      const e = 1 - k * k * (3 - 2 * k);
      const off = ((v.dist - clip.startDist) / 2) * e * (v.role === 'A' ? -1 : 1);
      for (const at of [P.HIPS, P.FOOT_L, P.FOOT_R, P.KNEE_L, P.KNEE_R, P.HAND_L, P.HAND_R, P.ELBOW_L, P.ELBOW_R]) {
        lp[at + 2] += off;
      }
    }

    // Experimental bar carry: follow the turning thorax instead of a chord
    // between pair-space wrist keys that cuts through the defender's body.
    if(!v.hold&&v.clip==='armBarSupportedSeatedTurnDraft'&&v.u>.50&&v.u<.94){
      const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
      const weight=smooth((v.u-.50)/.12)*smooth((.94-v.u)/.08);
      const q=new Quaternion().setFromEuler(new Euler(lp[P.HIPS_Q+1],lp[P.HIPS_Q],lp[P.HIPS_Q+2],'YXZ'));
      q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),lp[P.HIPS_Q+3]));
      const chest=new Vector3().fromArray(lp,P.HIPS).add(new Vector3(...BONE_DEF.spine.offset).multiplyScalar(this.scale).applyQuaternion(q));
      q.multiply(new Quaternion().setFromEuler(new Euler(lp[P.SPINE]*.45,lp[P.SPINE+1]*.45,lp[P.SPINE+2]*.45,'YXZ')));
      chest.add(new Vector3(...BONE_DEF.chest.offset).multiplyScalar(this.scale).applyQuaternion(q));
      q.multiply(new Quaternion().setFromEuler(new Euler(lp[P.SPINE]*.55,lp[P.SPINE+1]*.55,lp[P.SPINE+2]*.55,'YXZ')));
      const sign=v.mirror?-1:1;
      const routes:[number,number[]][]=v.role==='B'?[[v.mirror?P.HAND_R:P.HAND_L,[.24*sign,0,-.10]],[v.mirror?P.ELBOW_R:P.ELBOW_L,[.32*sign,.08,-.08]]]:[[v.mirror?P.ELBOW_R:P.ELBOW_L,[.42*sign,.10,.10]]];
      for(const [slot,offset] of routes){
        const point=new Vector3(...offset as [number,number,number]).multiplyScalar(this.scale).applyQuaternion(q).add(chest);
        for(let axis=0;axis<3;axis++)lp[slot+axis]+=(point.getComponent(axis)-lp[slot+axis])*weight;
      }
    }
    localToWorld(lp, v.frame, this.target);
    if (this.legFinishStart) {
      const t = Math.min(1, v.u / this.legFinishBlendEnd);
      blendPosture(this.legFinishStart, this.target, t*t*(3-2*t), this.legFinishTarget);
      this.target.set(this.legFinishTarget);
      if (t === 1) this.legFinishStart = null;
    }
    const recovery=v.clip==='recoverSeatedLegDefense'?this.recoveryStart:this.legReleaseStart;
    if(recovery) {
      const t=Math.min(1,v.clip==='recoverSeatedLegDefense'?v.u/.65:this.legReleaseAge/.8),w=t*t*(3-2*t),start=recovery;
      const q=new Quaternion().fromArray(start,P.HIPS_Q).slerp(new Quaternion().fromArray(this.target,P.HIPS_Q),w);
      const feet=[P.FOOT_L,P.FOOT_R].map(at=>{
        const x0=start[at]-start[P.HIPS],z0=start[at+2]-start[P.HIPS+2];
        const x1=this.target[at]-this.target[P.HIPS],z1=this.target[at+2]-this.target[P.HIPS+2];
        const a0=Math.atan2(x0,z0),delta=Math.atan2(Math.sin(Math.atan2(x1,z1)-a0),Math.cos(Math.atan2(x1,z1)-a0));
        const radius=Math.hypot(x0,z0)*(1-w)+Math.hypot(x1,z1)*w;
        return {at,x:Math.sin(a0+delta*w)*radius,z:Math.cos(a0+delta*w)*radius};
      });
      for(let i=0;i<P.SIZE;i++)this.target[i]=start[i]+(this.target[i]-start[i])*w;
      // Unhook around the pelvis instead of shortening through the hip axis.
      for(const f of feet){this.target[f.at]=this.target[P.HIPS]+f.x;this.target[f.at+2]=this.target[P.HIPS+2]+f.z;}
      if(this.legReleaseStart&&v.role==='A'&&(v.clip==='flat'||v.clip==='ride')){
        // Withdraw the hooked boot outside the thigh before settling it down.
        // The free leg remains a support; it does not mirror this clearance arc.
        const at=v.mirror?P.FOOT_R:P.FOOT_L,side=v.mirror?-1:1;
        const lift=Math.sin(Math.PI*w)*this.scale;
        this.target[at]+=.36*lift*side*Math.cos(v.frame.yaw);
        this.target[at+2]-=.36*lift*side*Math.sin(v.frame.yaw);
        this.target[at+1]+=.16*lift;
      }
      q.toArray(this.target,P.HIPS_Q);
    }
    this.feetDesired.set(this.target);
    const lw = lp[P.LOOK_W];
    this.lookAtOpponent(opp, lw);
  }

  /* ----------------------------------------------------------------- solo */

  private buildSolo(v: Extract<AnimView, { mode: 'solo' }>, opp: Animator | null): void {
    const lp = this.local;
    if (!sampleSolo(v.clip, v.u, lp)) {
      stancePose({ ...DEFAULT_STANCE, level: 0.95, guard: 0 }, lp);
    }
    if (v.mirror) mirrorLocal(lp, lp);
    if (v.grip && opp) this.contacts.push({ ...v.grip, weight: 1 });
    scaleLocal(lp, this.scale);
    localToWorld(lp, { x: v.x, z: v.z, yaw: v.yaw }, this.target);
    this.feetDesired.set(this.target);
    this.lookAtOpponent(opp, lp[P.LOOK_W]);
  }

  /** Root position of the pelvis right now (world). */
  hipsWorld(out: Vector3): Vector3 {
    return out.set(this.display[P.HIPS], this.display[P.HIPS + 1], this.display[P.HIPS + 2]);
  }

  /** Bone world matrix, for attaching props. */
  boneMatrix(name: BoneName): Matrix4 {
    this.character.bones[name].updateWorldMatrix(true, false);
    return _m.copy(this.character.bones[name].matrixWorld);
  }
}
