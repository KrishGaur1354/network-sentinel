# Network Sentinel

A comprehensive network monitoring plugin for Steam Deck. Monitor your network quality in real-time with live ping display, latency graphs, and detailed connection history tracking.

## Screenshots

### Home Panel
![Network Status](ss/home-ns.jpg)
### History Panel
![Network History](ss/history-ns.jpg)
### Settings Panel
![Settings](ss/setting-ns.jpg)

## Features

- **Real-time Network Monitoring**: Track latency, packet loss, and connection quality
- **Live Ping Display**: Persistent overlay showing current network status
- **Connection Quality Scoring**: Get quality ratings (excellent/good/fair/poor) with detailed metrics
- **Network History**: View historical connection data with latency graphs
- **Visual Indicators**: Color-coded quality indicators and intuitive graphs
- **Bandwidth Tracking**: Monitor network interface statistics
- **Customizable Settings**: Adjustable monitoring intervals and display options

## Installation

Install via Decky Loader plugin store (available soon) or manually:

1. Download the latest release
2. Extract to `/home/deck/homebrew/plugins/`
3. Restart Decky Loader or reload plugins

## Usage

1. **Start Monitoring**: Toggle monitoring to begin tracking network quality
2. **View Live Ping**: See real-time latency and connection quality
3. **Check History**: View latency graphs and historical performance data
4. **Adjust Settings**: Configure monitoring interval and preferences

## Requirements

- Steam Deck with Decky Loader installed
- Python dependencies: `psutil` (auto-installed)

## Development

Built using [decky-frontend-lib](https://github.com/SteamDeckHomebrew/decky-frontend-lib) and [decky-loader](https://github.com/SteamDeckHomebrew/decky-loader).

### Building from Source

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build the plugin:
   ```bash
   pnpm run build
   ```

3. Deploy to Steam Deck (Windows):
   ```powershell
   .\deploy.ps1
   ```

### Tech Stack

- **Frontend**: React + TypeScript with @decky/ui components
- **Backend**: Python with asyncio for network monitoring
- **Dependencies**: psutil for network interface statistics

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

BSD-3-Clause License - see [LICENSE](LICENSE) file for details.

## Author

Created by [Krish Gaur](https://github.com/KrishGaur1354)

- [GitHub](https://github.com/KrishGaur1354)
- [Twitter](https://twitter.com/ThatOneKrish)
