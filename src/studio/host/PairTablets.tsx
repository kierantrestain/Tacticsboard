import { useState } from 'react';
import { ArrowRight, Check, Copy, Download, Monitor, Radio, RefreshCw, Tablet, Wifi, X } from 'lucide-react';
import { useRuntime } from '../runtime';
import { setLiveFollow, openProgram } from '../production';
import { discoverStudioHub, endStudioRoom, roomControl, startStudioRoom, useStudioLink } from './producer';
import { roleName } from './protocol';
export default function PairTablets() {
  const link = useStudioLink(), r = useRuntime();
  const [copied, setCopied] = useState(false);
  const origins = link.session?.origins?.length ? link.session.origins : link.origins;
  const [chosen, setChosen] = useState('');
  const address = (chosen || origins[0] || location.origin) + '/?host=1';
  async function arm() {
    if (link.presence?.armed) { await roomControl({ action: 'arm', enabled: false }); setLiveFollow(false); return; }
    setLiveFollow(true);
    if (useRuntime.getState().follow) await roomControl({ action: 'arm', enabled: true });
  }
  return <div className="film-modal-backdrop"><section className="film-pair" role="dialog" aria-modal="true" aria-label="Connect host tablets">
    <header><div><h2>Connect tablets</h2></div><button className="film-icon" aria-label="Close tablet setup" onClick={() => r.set({ tabletPanel: false })}><X /></button></header>
    <p className="film-lead">Pair each tablet with its own code.</p>
    {link.available === false ? <>
      <div className="film-hub-card"><Wifi size={28} /><div><strong>Run the Studio Hub on the show computer</strong><p>Connect the computer and both tablets to the same trusted Wi-Fi.</p></div></div>
      <ol className="film-setup-steps"><li><b>Download & unzip</b><span>The complete studio is included.</span><a className="film-button primary" href="/touchline-studio-hub.zip" download><Download size={17}/>Download Studio Hub</a></li><li><b>Start the studio</b><span>With Node.js 22+ installed, run this in the unzipped folder:</span><code>node scripts/studio-hub.mjs</code></li><li><b>Open the desk</b><span>Open <strong>http://localhost:4174</strong> on the show computer, import your project pack, then choose Connect tablets.</span></li></ol>
      <div className="film-pair-note">Project packs carry your footage and saved analysis between this online workspace and the local studio.</div>
      <button className="film-button" onClick={() => void discoverStudioHub()}><RefreshCw size={16}/>Check connection</button>
    </> : !link.session ? <>
      <div className="film-connection-diagram"><span><Monitor/>Show computer<small>Project + TV output</small></span><i>↔</i><span><Tablet/>Host 1<small>Presenter controls</small></span><span><Tablet/>Host 2<small>Presenter controls</small></span></div>
      <button className="film-button primary large" disabled={!link.canProduce} onClick={() => void startStudioRoom()}>Create filming session<ArrowRight size={19}/></button>
      {!link.canProduce && <p>Open the producer desk at localhost on the show computer to create a session.</p>}
    </> : <>
      <div className="film-pair-address"><span>OPEN ON BOTH TABLETS</span>{!origins.length&&<label className="film-field">Show computer network address<input aria-label="Manual studio network address" placeholder="http://192.168.1.10:4174" value={chosen} onChange={e=>setChosen(e.target.value.replace(/\/$/,''))}/><small>Enter the computer’s local IP address if it could not be detected.</small></label>}<div><input aria-label="Tablet address" value={address} readOnly onFocus={e => e.target.select()}/><button className="film-button" onClick={async () => { try { await navigator.clipboard.writeText(address); setCopied(true); } catch { link.set({ error: 'Select the address above to copy it.' }); } }}>{copied ? <Check size={18}/> : <Copy size={18}/>}Copy</button></div>{origins.length > 1 && <select aria-label="Studio network address" value={chosen || origins[0]} onChange={e => setChosen(e.target.value)}>{origins.map(o => <option key={o}>{o}</option>)}</select>}</div>
      <div className="film-host-slots">{(['host1', 'host2'] as const).map(role => <article key={role} className={link.presence?.owner === role ? 'active' : ''}><div><Tablet size={23}/><strong>{roleName(role)}</strong><i className={link.presence?.connected[role] ? 'online' : ''}/></div><span className="film-pair-code">{link.presence?.connected[role] ? 'Connected' : link.session?.codes[role] || 'Pair again'}</span><small>{link.presence?.owner === role ? 'CONTROLLING THE SCREEN' : link.presence?.connected[role] ? 'Watching · ready for handover' : 'Enter this code · valid for 10 minutes'}</small><div className="film-slot-actions"><button onClick={async () => { const result = await roomControl({ action: 'pair', role }); if (result?.code && link.session) { const session = { ...link.session, codes: { ...link.session.codes, [role]: result.code }, expiresAt: result.expiresAt }; sessionStorage.setItem('touchline.producer-room', JSON.stringify(session)); link.set({ session }); } }}>New code</button><button disabled={!link.presence?.armed || !link.presence.connected[role]} onClick={() => void roomControl({ action: 'grant', to: role })}>Give control</button></div></article>)}</div>
      <div className="film-pair-note"><strong>{link.status === 'connected' ? 'Studio connected' : 'Connection interrupted'}</strong><span>{link.presence?.requested ? `${roleName(link.presence.requested)} is requesting control.` : 'One host controls the screen at a time.'}</span></div>
      <div className="film-pair-actions"><button className="film-button" onClick={openProgram}><Monitor size={18}/>Open TV output</button><button className="film-button primary" disabled={link.status !== 'connected' || !!r.program?.black} onClick={() => void arm()}><Radio size={18}/>{link.presence?.armed ? 'Hold tablet controls' : 'Enable hosts · follow on TV'}</button></div>
      <button className="film-text-button danger" onClick={() => void endStudioRoom()}>End session & disconnect tablets</button>
    </>}
    {link.error && <p role="alert" className="film-alert">{link.error}</p>}
  </section></div>;
}
