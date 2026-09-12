// Private per-account storage. Saves are immutable snapshots: no prior version is overwritten.
export class DriveWorkspace {
  constructor(fetcher=(...args)=>globalThis.fetch(...args)){this.fetcher=fetcher;this.token='';this.expires=0;this.head='';this.folderId='';this.folderName='';}
  authorize(token,seconds){this.token=token;this.expires=Date.now()+(Number(seconds)-30)*1000;}
  clear(){this.token='';this.expires=0;this.head='';this.folderId='';this.folderName='';}
  async selectFolder(id){
    if(!/^[\w-]+$/.test(id))throw new Error('Choose a valid Google Drive folder.');
    const folder=await (await this.request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,capabilities(canAddChildren)&supportsAllDrives=true')).json();
    if(folder.mimeType!=='application/vnd.google-apps.folder'||!folder.capabilities?.canAddChildren)throw new Error('Choose a folder where your storage account can add files.');
    this.folderId=folder.id;this.folderName=folder.name;this.head='';
  }
  async request(url,options={}){
    if(!this.token||Date.now()>=this.expires)throw new Error('Google access expired. Reconnect Google Drive in Settings, then retry saving. Your unsaved work is still here.');
    const r=await this.fetcher(url,{...options,headers:{...options.headers,Authorization:'Bearer '+this.token}});
    if(!r.ok){let body;try{body=await r.json();}catch{}throw new Error(body?.error?.message||`Google Drive request failed (${r.status}).`);}
    return r;
  }
  async versions(){if(!this.folderId)throw new Error('Select your storage folder first.');const q=new URLSearchParams({spaces:'drive',q:`'${this.folderId}' in parents and trashed = false and appProperties has { key='app' and value='fieldnotes-v1' }`,orderBy:'createdTime desc',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true',fields:'files(id,name,createdTime,appProperties),nextPageToken'});return (await (await this.request('https://www.googleapis.com/drive/v3/files?'+q)).json()).files||[];}
  async read(id){return (await this.request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media')).json();}
  async load(){const versions=await this.versions();this.head=versions[0]?.id||'';return {data:this.head?await this.read(this.head):null,versions};}
  async save(data){
    const versions=await this.versions();
    if((versions[0]?.id||'')!==this.head)throw new Error('A newer Drive version exists. Export your unsaved work, then use Version history to review it before merging.');
    const boundary='fieldnotes_'+crypto.randomUUID();
    const meta={name:'Fieldnotes '+new Date().toISOString()+'.json',mimeType:'application/json',parents:[this.folderId],appProperties:{app:'fieldnotes-v1',parent:this.head||'root'}};
    const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
    const r=await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
    this.head=(await r.json()).id;
  }
}

