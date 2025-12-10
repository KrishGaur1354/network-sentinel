import os
import subprocess
import json
import time
import threading
import psutil
import socket
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import asyncio

import decky

class NetworkMonitor:
    def __init__(self):
        self.monitoring = False
        self.network_data = []
        self.server_pings = {}
        self.connection_history = []
        self.lock = threading.Lock()
        
    def ping_host(self, host: str, count: int = 3) -> Dict:
        """ping a host and get stats"""
        try:
            cmd = ['ping', '-c', str(count), '-W', '2', host]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                output = result.stdout
                lines = output.split('\n')
                avg_rtt = 0
                packet_loss = 0
                jitter = 0
                ping_times = []
                
                for line in lines:
                    if 'rtt min/avg/max' in line or 'round-trip' in line:
                        parts = line.split('=')
                        if len(parts) > 1:
                            values = parts[1].split('/')
                            if len(values) >= 2:
                                try:
                                    avg_rtt = float(values[1].strip().split()[0])
                                except:
                                    pass
                            if len(values) >= 4:
                                try:
                                    jitter = float(values[3].strip().split()[0])
                                except:
                                    pass
                    
                    if 'packet loss' in line:
                        try:
                            packet_loss = float(line.split('%')[0].split()[-1])
                        except:
                            pass
                    
                    if 'time=' in line:
                        try:
                            ping_times.append(float(line.split('time=')[1].split()[0]))
                        except:
                            pass
                
                if avg_rtt == 0:
                    for line in lines:
                        if 'time=' in line:
                            try:
                                avg_rtt = float(line.split('time=')[1].split()[0])
                                break
                            except:
                                pass
                
                # prefer graceful fallback when ping data is incomplete
                if jitter == 0 and len(ping_times) > 1:
                    diffs = [abs(ping_times[i] - ping_times[i-1]) for i in range(1, len(ping_times))]
                    if diffs:
                        jitter = sum(diffs) / len(diffs)
                
                return {
                    'host': host,
                    'success': True,
                    'avg_rtt': avg_rtt if avg_rtt > 0 else 999,
                    'packet_loss': packet_loss,
                    'jitter': jitter,
                    'samples': len(ping_times) if ping_times else count
                }
            else:
                return {'host': host, 'success': False, 'avg_rtt': 999, 'packet_loss': 100, 'jitter': jitter, 'samples': 0}
                
        except Exception as e:
            decky.logger.error(f"Ping error: {e}")
            return {'host': host, 'success': False, 'avg_rtt': 999, 'packet_loss': 100, 'jitter': 0, 'samples': 0}
    
    def get_network_interface_stats(self) -> Dict:
        """Get network interface statistics"""
        try:
            net_io = psutil.net_io_counters()
            return {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv,
                'packets_sent': net_io.packets_sent,
                'packets_recv': net_io.packets_recv,
                'errin': net_io.errin,
                'errout': net_io.errout,
                'dropin': net_io.dropin,
                'dropout': net_io.dropout
            }
        except Exception as e:
            return {'error': str(e)}
    
    def test_connection_quality(self) -> Dict:
        """test connection quality"""
        ping_result = self.ping_host('8.8.8.8', 3)
        
        if not ping_result.get('success', False):
            return {
                'quality': 'disconnected',
                'score': 0,
                'avg_latency': 999,
                'avg_packet_loss': 100,
                'jitter': ping_result.get('jitter', 0)
            }
        
        avg_latency = ping_result.get('avg_rtt', 999)
        avg_packet_loss = ping_result.get('packet_loss', 0)
        jitter = ping_result.get('jitter', 0)
        
        score = 100
        if avg_latency > 150:
            score -= 40
        elif avg_latency > 100:
            score -= 25
        elif avg_latency > 50:
            score -= 10
        
        if avg_packet_loss > 5:
            score -= 40
        elif avg_packet_loss > 2:
            score -= 20
        elif avg_packet_loss > 0:
            score -= 10
        
        # add jitter into the scoring to catch instability
        if jitter > 40:
            score -= 25
        elif jitter > 25:
            score -= 15
        elif jitter > 10:
            score -= 5
        
        if score >= 85:
            quality = 'excellent'
        elif score >= 65:
            quality = 'good'
        elif score >= 40:
            quality = 'fair'
        else:
            quality = 'poor'
        
        return {
            'quality': quality,
            'score': max(0, score),
            'avg_latency': avg_latency,
            'avg_packet_loss': avg_packet_loss,
            'jitter': jitter
        }
    
    def ping_game_servers(self, servers: List[Dict]) -> Dict:
        """Ping multiple game servers"""
        results = {}
        
        for server in servers:
            name = server.get('name', 'Unknown')
            host = server.get('host', '')
            region = server.get('region', 'Unknown')
            
            if host:
                ping_result = self.ping_host(host, 3)
                ping_result['name'] = name
                ping_result['region'] = region
                results[name] = ping_result
        
        return results

class Plugin:
    def __init__(self):
        self.monitor = NetworkMonitor()
        self.monitoring_task = None
        self.settings = {
            'auto_monitor': False,
            'notification_threshold': 50,
            'ping_interval': 0.5,
            'show_bandwidth': True,
            'dns_servers': ['8.8.8.8', '1.1.1.1'],
            'speed_unit': 'mbps'
        }
        self.live_ping = 0
        self.bandwidth_stats = {'download_bps': 0, 'upload_bps': 0}
        self.last_dns_status = {'success': True, 'dns_server': '8.8.8.8', 'resolution_time': 0}
        
    # Network monitoring methods
    async def start_monitoring(self):
        """Start continuous network monitoring"""
        if not self.monitor.monitoring:
            self.monitor.monitoring = True
            self.monitoring_task = asyncio.create_task(self._monitoring_loop())
            decky.logger.info("Network monitoring started")
            return True
        return False
    
    async def stop_monitoring(self):
        """Stop network monitoring"""
        if self.monitor.monitoring:
            self.monitor.monitoring = False
            if self.monitoring_task:
                self.monitoring_task.cancel()
            decky.logger.info("Network monitoring stopped")
            return True
        return False
    
    async def _monitoring_loop(self):
        """Background monitoring loop - simpler and more reliable"""
        prev_bytes_sent = None
        prev_bytes_recv = None
        last_check_time = time.time()
        self.last_dns_check = time.time()
        
        while self.monitor.monitoring:
            try:
                current_time = time.time()
                time_delta = current_time - last_check_time
                
                # Get network stats first (doesn't require network access)
                net_stats = self.monitor.get_network_interface_stats()
                
                # calculate bandwidth in bits per second with real elapsed time
                if prev_bytes_sent is not None and prev_bytes_recv is not None and time_delta > 0:
                    upload_bps = (net_stats['bytes_sent'] - prev_bytes_sent) / time_delta * 8
                    download_bps = (net_stats['bytes_recv'] - prev_bytes_recv) / time_delta * 8
                    self.bandwidth_stats = {
                        'download_bps': max(0, download_bps),
                        'upload_bps': max(0, upload_bps)
                    }
                
                prev_bytes_sent = net_stats['bytes_sent']
                prev_bytes_recv = net_stats['bytes_recv']
                last_check_time = current_time
                
                # only ping every ping_interval seconds
                interval = self.settings.get('ping_interval', 30)
                if hasattr(self, 'last_ping_time'):
                    time_since_ping = current_time - self.last_ping_time
                    if time_since_ping >= interval:
                        try:
                            socket.create_connection(("8.8.8.8", 53), timeout=2).close()
                            quality_result = self.monitor.test_connection_quality()
                        except Exception:
                            quality_result = {
                                'quality': 'disconnected',
                                'score': 0,
                                'avg_latency': 999,
                                'avg_packet_loss': 100,
                                'jitter': 0
                            }
                        self.live_ping = quality_result.get('avg_latency', 0)
                        self.last_quality = quality_result
                        self.last_ping_time = current_time
                else:
                    try:
                        socket.create_connection(("8.8.8.8", 53), timeout=2).close()
                        quality_result = self.monitor.test_connection_quality()
                    except Exception:
                        quality_result = {
                            'quality': 'disconnected',
                            'score': 0,
                            'avg_latency': 999,
                            'avg_packet_loss': 100,
                            'jitter': 0
                        }
                    self.live_ping = quality_result.get('avg_latency', 0)
                    self.last_quality = quality_result
                    self.last_ping_time = current_time
                
                # Use last known quality if available
                if not hasattr(self, 'last_quality'):
                    self.last_quality = {'quality': 'unknown', 'score': 0, 'avg_latency': 0, 'avg_packet_loss': 0}
                
                # Store data point
                data_point = {
                    'timestamp': datetime.now().isoformat(),
                    'quality': self.last_quality,
                    'live_ping': self.live_ping,
                    'bandwidth': self.bandwidth_stats,
                    'dns_status': self.last_dns_status
                }
                
                with self.monitor.lock:
                    self.monitor.network_data.append(data_point)
                    # Keep only last 50 data points
                    if len(self.monitor.network_data) > 50:
                        self.monitor.network_data.pop(0)
                
                # reuse recent dns result instead of spamming lookups
                if current_time - getattr(self, 'last_dns_check', 0) >= max(interval, 20):
                    self.last_dns_status = await self.test_dns()
                    self.last_dns_check = current_time
                
                # Update frequently to honor short intervals
                await asyncio.sleep(0.5)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                decky.logger.error(f"Monitoring error: {e}")
                await asyncio.sleep(5)
    
    async def test_single_ping(self, host: str = '8.8.8.8') -> Dict:
        """Test a single ping manually"""
        return self.monitor.ping_host(host, 3)
    
    async def get_network_status(self) -> Dict:
        """Get current network status"""
        quality_result = self.monitor.test_connection_quality()
        net_stats = self.monitor.get_network_interface_stats()
        self.last_dns_status = await self.test_dns()
        self.last_dns_check = time.time()
        
        return {
            'quality': quality_result,
            'network_stats': net_stats,
            'monitoring': self.monitor.monitoring,
            'data_points': len(self.monitor.network_data),
            'bandwidth': self.bandwidth_stats,
            'dns_status': self.last_dns_status
        }
    
    async def get_network_history(self) -> List[Dict]:
        """Get network monitoring history"""
        with self.monitor.lock:
            return self.monitor.network_data.copy()
    
    async def clear_history(self):
        """Clear network monitoring history"""
        with self.monitor.lock:
            self.monitor.network_data.clear()
        decky.logger.info("Network history cleared")
    
    async def get_live_ping(self) -> float:
        """Get current live ping"""
        return self.live_ping
    
    async def get_bandwidth_stats(self) -> Dict:
        """Get current bandwidth statistics"""
        return self.bandwidth_stats
    
    async def update_settings(self, settings: Dict) -> bool:
        """Update plugin settings"""
        try:
            self.settings.update(settings)
            decky.logger.info(f"Settings updated: {settings}")
            return True
        except Exception as e:
            decky.logger.error(f"Failed to update settings: {e}")
            return False
    
    async def get_settings(self) -> Dict:
        """Get current plugin settings"""
        return self.settings
    
    async def test_dns(self, dns_server: str = None) -> Dict:
        """Test DNS resolution speed"""
        import time
        test_domain = "google.com"
        dns = dns_server or self.settings.get('dns_servers', ['8.8.8.8'])[0]
        
        try:
            start = time.time()
            socket.gethostbyname(test_domain)
            resolution_time = (time.time() - start) * 1000  # Convert to ms
            
            return {
                'success': True,
                'dns_server': dns,
                'domain': test_domain,
                'resolution_time': resolution_time
            }
        except Exception as e:
            return {
                'success': False,
                'dns_server': dns,
                'error': str(e)
            }
    
    async def get_connection_info(self) -> Dict:
        """Get detailed connection information"""
        try:
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            conn_type = self._detect_connection_type()
            
            return {
                'hostname': hostname,
                'local_ip': local_ip,
                'connection_type': conn_type,
                'monitoring': self.monitor.monitoring,
                'live_ping': self.live_ping,
                'bandwidth': self.bandwidth_stats
            }
        except Exception as e:
            return {'error': str(e)}
    
    def _detect_connection_type(self) -> str:
        """best-effort detection of active connection type"""
        try:
            result = subprocess.run(
                ["nmcli", "-t", "-f", "TYPE,STATE,DEVICE", "device"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                for line in result.stdout.splitlines():
                    parts = line.split(":")
                    if len(parts) >= 2:
                        dev_type, state = parts[0], parts[1]
                        if state == "connected":
                            if dev_type == "wifi":
                                return "wifi"
                            if dev_type == "ethernet":
                                return "ethernet"
                            if "cell" in dev_type or "gsm" in dev_type:
                                return "tether"
            # fallback to routing table
            route = subprocess.run(
                ["ip", "route", "show", "default"],
                capture_output=True,
                text=True,
                timeout=3
            )
            if route.returncode == 0 and route.stdout:
                if "wlan" in route.stdout or "wifi" in route.stdout:
                    return "wifi"
                if "eth" in route.stdout or "enp" in route.stdout:
                    return "ethernet"
                if "usb" in route.stdout or "rndis" in route.stdout:
                    return "tether"
            return "unknown"
        except Exception:
            return "unknown"
    
    async def scan_wifi_networks(self) -> Dict:
        """scan nearby wifi networks and compute simple quality estimates"""
        try:
            # prefer nmcli for consistent parsing on steam deck
            scan = subprocess.run(
                ["nmcli", "-t", "-f", "SSID,SIGNAL,FREQ,CHAN,BARS,SECURITY", "device", "wifi", "list"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if scan.returncode != 0:
                return {"error": scan.stderr.strip() or "nmcli failed"}
            
            networks = []
            channel_counts = {}
            for line in scan.stdout.splitlines():
                # ignore empty rows from the scanner
                parts = line.split(":")
                if len(parts) < 4:
                    continue
                ssid = parts[0] or "<hidden>"
                try:
                    signal = int(parts[1])
                except:
                    signal = 0
                try:
                    freq = float(parts[2]) if parts[2] else 0
                except:
                    freq = 0
                try:
                    chan = int(parts[3]) if parts[3] else 0
                except:
                    chan = 0
                
                band = "2.4GHz" if freq and freq < 3000 else "5GHz"
                channel_counts[chan] = channel_counts.get(chan, 0) + 1
                networks.append({
                    "ssid": ssid,
                    "signal": signal,
                    "freq": freq,
                    "channel": chan,
                    "band": band,
                    "security": parts[5] if len(parts) > 5 else "",
                })
            
            for net in networks:
                # simple latency heuristic based on rssi and crowding
                congestion = channel_counts.get(net["channel"], 1)
                base_latency = max(8, 220 - net["signal"] * 1.6)
                band_penalty = 10 if net["band"] == "2.4GHz" else 0
                congestion_penalty = max(0, (congestion - 1) * 8)
                net["estimated_latency_ms"] = round(base_latency + band_penalty + congestion_penalty, 1)
                net["congestion"] = congestion
            
            # suggest best channel by lowest congestion then highest signal sum
            best_channel = None
            if channel_counts:
                best_channel = sorted(
                    channel_counts.items(),
                    key=lambda item: (item[1], -sum([n["signal"] for n in networks if n["channel"] == item[0]]))
                )[0][0]
            
            return {
                "networks": networks,
                "best_channel": best_channel,
                "channel_load": channel_counts
            }
        except Exception as e:
            return {"error": str(e)}
    

    # Asyncio-compatible long-running code, executed in a task when the plugin is loaded
    async def _main(self):
        self.loop = asyncio.get_event_loop()
        decky.logger.info("Network Sentinel plugin loaded")
        
        # Load settings
        try:
            settings_path = os.path.join(decky.DECKY_SETTINGS_DIR, "network-sentinel.json")
            if os.path.exists(settings_path):
                with open(settings_path, 'r') as f:
                    self.settings = json.load(f)
        except Exception as e:
            decky.logger.error(f"Failed to load settings: {e}")
            self.settings = {}

    # Function called first during the unload process
    async def _unload(self):
        decky.logger.info("Network Sentinel plugin unloading")
        await self.stop_monitoring()
        
        # Save settings
        try:
            settings_path = os.path.join(decky.DECKY_SETTINGS_DIR, "network-sentinel.json")
            with open(settings_path, 'w') as f:
                json.dump(self.settings, f, indent=2)
        except Exception as e:
            decky.logger.error(f"Failed to save settings: {e}")

    # Function called after `_unload` during uninstall
    async def _uninstall(self):
        decky.logger.info("Network Sentinel plugin uninstalled")
        pass

    # Migrations that should be performed before entering `_main()`.
    async def _migration(self):
        decky.logger.info("Migrating Network Sentinel plugin")
        # Migrate logs
        decky.migrate_logs(os.path.join(decky.DECKY_USER_HOME,
                                               ".config", "network-sentinel", "network-sentinel.log"))
        # Migrate settings
        decky.migrate_settings(
            os.path.join(decky.DECKY_HOME, "settings", "network-sentinel.json"),
            os.path.join(decky.DECKY_USER_HOME, ".config", "network-sentinel"))
        # Migrate runtime data
        decky.migrate_runtime(
            os.path.join(decky.DECKY_HOME, "network-sentinel"),
            os.path.join(decky.DECKY_USER_HOME, ".local", "share", "network-sentinel"))
