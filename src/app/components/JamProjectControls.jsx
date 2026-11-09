import { useId, useRef } from 'react';

export default function JamProjectControls({ project, projects, disabled, transient, onNew, onOpen, onRename }) {
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
      <small>{transient ? '修改保留在当前预览页面，刷新会清空。' : '所有修改自动保留在当前浏览器。'}</small>
    </div>
    <button type="button" className="performance-connect" disabled={disabled} onClick={onNew}>新建项目</button>
  </div>;
}
