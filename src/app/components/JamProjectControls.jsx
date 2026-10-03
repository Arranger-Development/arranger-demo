import { useId, useRef } from 'react';

export default function JamProjectControls({ project, projects, disabled, onSave, onNew, onOpen, onRename }) {
  const id = useId(), menu = useRef(null);
  const close = () => menu.current?.hidePopover();
  return <div className="jam-project-controls" role="group" aria-label="Jam 项目">
    <button type="button" className="performance-connect jam-project-name" disabled={disabled} popoverTarget={id} title={project.name}>{project.name} ▾</button>
    <div ref={menu} id={id} popover="auto" className="jam-project-menu">
      <label>打开项目<select aria-label="打开 Jam 项目" value={project.id} onChange={e=>{if(onOpen(e.target.value))close();}}>
        {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <form key={`${project.id}:${project.name}`} onSubmit={e=>{e.preventDefault();if(onRename(new FormData(e.currentTarget).get('name')))close();}}>
        <label>项目名称<input aria-label="Jam 项目名称" name="name" required maxLength={80} defaultValue={project.name}/></label>
        <button type="submit">重命名</button>
      </form>
      <small>保存在当前浏览器。保存项目会保留草稿；保存段落才加入 Loop 列表。</small>
    </div>
    <button type="button" className="performance-connect" disabled={disabled} onClick={onSave}>保存项目</button>
    <button type="button" className="performance-connect" disabled={disabled} onClick={onNew}>新建项目</button>
  </div>;
}
