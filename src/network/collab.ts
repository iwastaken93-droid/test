/**
 * Collaborative Workspace Sync engine.
 * Supports mock WebRTC/WebSocket sync of session comments, highlighted addresses, and decompilation renames.
 */

export interface Peer {
  id: string;
  name: string;
  color: string;
  status: 'connected' | 'idle' | 'disconnected';
}

export interface SyncComment {
  address: number;
  comment: string;
  peerName: string;
  timestamp: number;
}

export interface SyncHighlight {
  address: number;
  color: string;
  peerName: string;
  timestamp: number;
}

export interface SyncRename {
  originalName: string;
  renamedName: string;
  type: 'function' | 'variable';
  peerName: string;
  timestamp: number;
}

type ConnectionStateCallback = (connected: boolean) => void;
type PeerCallback = (peers: Peer[]) => void;
type CommentCallback = (data: SyncComment) => void;
type HighlightCallback = (data: SyncHighlight) => void;
type RenameCallback = (data: SyncRename) => void;

export class CollabEngine {
  private connected: boolean = false;
  private roomName: string = '';
  private username: string = '';
  private peers: Peer[] = [];
  private comments: Map<number, SyncComment> = new Map();
  private highlights: Map<number, SyncHighlight> = new Map();
  private renames: Map<string, SyncRename> = new Map();

  // Callbacks
  private onConnectionStateCallbacks: Set<ConnectionStateCallback> = new Set();
  private onPeerCallbacks: Set<PeerCallback> = new Set();
  private onCommentCallbacks: Set<CommentCallback> = new Set();
  private onHighlightCallbacks: Set<HighlightCallback> = new Set();
  private onRenameCallbacks: Set<RenameCallback> = new Set();

  private simulationInterval: any = null;

  constructor() {}

  public isConnected(): boolean {
    return this.connected;
  }

  public getRoomName(): string {
    return this.roomName;
  }

  public getUsername(): string {
    return this.username;
  }

  public getPeers(): Peer[] {
    return [...this.peers];
  }

  public getComments(): Map<number, SyncComment> {
    return new Map(this.comments);
  }

  public getHighlights(): Map<number, SyncHighlight> {
    return new Map(this.highlights);
  }

  public getRenames(): Map<string, SyncRename> {
    return new Map(this.renames);
  }

  // Event subscription
  public subscribeConnectionState(cb: ConnectionStateCallback): () => void {
    this.onConnectionStateCallbacks.add(cb);
    return () => this.onConnectionStateCallbacks.delete(cb);
  }

  public subscribePeers(cb: PeerCallback): () => void {
    this.onPeerCallbacks.add(cb);
    return () => this.onPeerCallbacks.delete(cb);
  }

  public subscribeComment(cb: CommentCallback): () => void {
    this.onCommentCallbacks.add(cb);
    return () => this.onCommentCallbacks.delete(cb);
  }

  public subscribeHighlight(cb: HighlightCallback): () => void {
    this.onHighlightCallbacks.add(cb);
    return () => this.onHighlightCallbacks.delete(cb);
  }

  public subscribeRename(cb: RenameCallback): () => void {
    this.onRenameCallbacks.add(cb);
    return () => this.onRenameCallbacks.delete(cb);
  }

  /**
   * Connect to collaborative room.
   */
  public connect(room: string, username: string): void {
    if (this.connected) return;

    this.roomName = room;
    this.username = username || 'ReverseEngineer';
    this.connected = true;

    // Set up initial peers
    this.peers = [
      { id: 'p1', name: 'Alice_SEC', color: '#10B981', status: 'connected' },
      { id: 'p2', name: 'Bob_Fuzz', color: '#3B82F6', status: 'connected' },
      { id: 'p3', name: 'Charlie_Mal', color: '#F59E0B', status: 'idle' },
    ];

    // Trigger state changes
    this.notifyConnectionState();
    this.notifyPeers();

    // Start simulating remote activity (periodic mock messages)
    this.startSimulation();
  }

  /**
   * Disconnect from collaboration room.
   */
  public disconnect(): void {
    if (!this.connected) return;

    this.stopSimulation();
    this.connected = false;
    this.roomName = '';
    this.username = '';
    this.peers = [];
    this.comments.clear();
    this.highlights.clear();
    this.renames.clear();

    this.notifyConnectionState();
    this.notifyPeers();
  }

  /**
   * Broadcast a comment to all peers.
   */
  public sendComment(address: number, comment: string): void {
    if (!this.connected) return;

    const data: SyncComment = {
      address,
      comment,
      peerName: this.username,
      timestamp: Date.now(),
    };
    this.comments.set(address, data);
    this.notifyComment(data);
  }

  /**
   * Broadcast a highlighted address.
   */
  public sendHighlight(address: number, color: string): void {
    if (!this.connected) return;

    const data: SyncHighlight = {
      address,
      color,
      peerName: this.username,
      timestamp: Date.now(),
    };
    this.highlights.set(address, data);
    this.notifyHighlight(data);
  }

  /**
   * Broadcast a decompilation rename.
   */
  public sendRename(originalName: string, renamedName: string, type: 'function' | 'variable'): void {
    if (!this.connected) return;

    const data: SyncRename = {
      originalName,
      renamedName,
      type,
      peerName: this.username,
      timestamp: Date.now(),
    };
    this.renames.set(originalName, data);
    this.notifyRename(data);
  }

  /**
   * Simulate a remote peer action explicitly.
   */
  public simulateRemoteAction(): void {
    if (!this.connected) return;

    const actions = ['comment', 'highlight', 'rename', 'peer_join', 'peer_leave'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const mockPeers = this.peers.filter(p => p.status === 'connected');
    if (mockPeers.length === 0 && action !== 'peer_join') return;

    const randomPeer = mockPeers[Math.floor(Math.random() * mockPeers.length)];

    switch (action) {
      case 'comment': {
        const addresses = [0x1000, 0x1020, 0x1044, 0x2010];
        const commentList = [
          'Possible decryption loop here.',
          'Checking entropy of this buffer.',
          'Function entry point - standard GCC prologue.',
          'Avoid executing this branch - contains antidebug checks.',
        ];
        const address = addresses[Math.floor(Math.random() * addresses.length)];
        const comment = commentList[Math.floor(Math.random() * commentList.length)];
        const data: SyncComment = {
          address,
          comment,
          peerName: randomPeer.name,
          timestamp: Date.now(),
        };
        this.comments.set(address, data);
        this.notifyComment(data);
        break;
      }
      case 'highlight': {
        const addresses = [0x1004, 0x1028, 0x1080, 0x2014];
        const colors = ['#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];
        const address = addresses[Math.floor(Math.random() * addresses.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const data: SyncHighlight = {
          address,
          color,
          peerName: randomPeer.name,
          timestamp: Date.now(),
        };
        this.highlights.set(address, data);
        this.notifyHighlight(data);
        break;
      }
      case 'rename': {
        const renames = [
          { oldName: 'sub_1000', newName: 'decrypt_payload', type: 'function' },
          { oldName: 'sub_1040', newName: 'initialize_socket', type: 'function' },
          { oldName: 'dword_4020', newName: 'g_is_debugged', type: 'variable' },
          { oldName: 'local_8', newName: 'key_index', type: 'variable' },
        ] as const;
        const rename = renames[Math.floor(Math.random() * renames.length)];
        const data: SyncRename = {
          originalName: rename.oldName,
          renamedName: rename.newName,
          type: rename.type,
          peerName: randomPeer.name,
          timestamp: Date.now(),
        };
        this.renames.set(rename.oldName, data);
        this.notifyRename(data);
        break;
      }
      case 'peer_join': {
        const names = ['Dave_Crypt', 'Eve_Pwn', 'Mallory_Mitm'];
        const unusedName = names.find(n => !this.peers.some(p => p.name === n));
        if (unusedName) {
          const newPeer: Peer = {
            id: 'p_' + Date.now(),
            name: unusedName,
            color: '#EC4899',
            status: 'connected',
          };
          this.peers.push(newPeer);
          this.notifyPeers();
        }
        break;
      }
      case 'peer_leave': {
        if (this.peers.length > 1) {
          const index = Math.floor(Math.random() * this.peers.length);
          this.peers.splice(index, 1);
          this.notifyPeers();
        }
        break;
      }
    }
  }

  // Internal notification triggers
  private notifyConnectionState(): void {
    for (const cb of this.onConnectionStateCallbacks) {
      try {
        cb(this.connected);
      } catch (e) {
        console.error(e);
      }
    }
  }

  private notifyPeers(): void {
    for (const cb of this.onPeerCallbacks) {
      try {
        cb([...this.peers]);
      } catch (e) {
        console.error(e);
      }
    }
  }

  private notifyComment(data: SyncComment): void {
    for (const cb of this.onCommentCallbacks) {
      try {
        cb(data);
      } catch (e) {
        console.error(e);
      }
    }
  }

  private notifyHighlight(data: SyncHighlight): void {
    for (const cb of this.onHighlightCallbacks) {
      try {
        cb(data);
      } catch (e) {
        console.error(e);
      }
    }
  }

  private notifyRename(data: SyncRename): void {
    for (const cb of this.onRenameCallbacks) {
      try {
        cb(data);
      } catch (e) {
        console.error(e);
      }
    }
  }

  private startSimulation(): void {
    this.stopSimulation();
    // Simulate actions every 15 seconds to avoid cluttering but show life
    this.simulationInterval = setInterval(() => {
      this.simulateRemoteAction();
    }, 15000);
  }

  private stopSimulation(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }
}
