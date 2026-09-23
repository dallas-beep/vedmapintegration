<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Community Events Map</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 16px;
            background-color: #f9f9f9;
            color: #333;
        }
        .community-map-wrapper {
            display: grid;
            grid-template-columns: 380px 1fr;
            gap: 20px;
            height: 88vh;
            min-height: 550px;
            max-width: 1400px;
            margin: 0 auto;
            box-sizing: border-box;
        }
        @media (max-width: 1200px) {
            .community-map-wrapper {
                grid-template-columns: 300px 1fr;
                gap: 15px;
            }
        }
        @media (max-width: 768px) {
            .community-map-wrapper {
                grid-template-columns: 280px 1fr;
                gap: 12px;
                height: 70vh;
                padding: 0;
            }
            body {
                padding: 8px;
            }
        }
        @media (max-width: 480px) {
            .community-map-wrapper {
                grid-template-columns: 100px 1fr;
                gap: 8px;
            }
        }
        
        .map-sidebar-panel {
            display: flex;
            flex-direction: column;
            gap: 14px;
            height: 100%;
            box-sizing: border-box;
        }

        .search-controls-wrapper {
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: #ffffff;
            padding: 16px;
            border-radius: 12px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.03);
        }
        @media (max-width: 768px) {
            .search-controls-wrapper {
                padding: 12px;
                gap: 8px;
            }
        }
        @media (max-width: 480px) {
            .search-controls-wrapper {
                padding: 8px;
                gap: 6px;
                display: none;
            }
        }

        .search-bar-container {
            position: relative;
            display: flex;
            align-items: center;
        }
        .search-bar-container input {
            width: 100%;
            padding: 12px 48px 12px 16px;
            border: 1px solid #ddd;
            border-radius: 30px;
            font-size: 14px;
            outline: none;
            background: #ffffff;
            transition: border-color 0.2s;
        }
        @media (max-width: 768px) {
            .search-bar-container input {
                padding: 10px 40px 10px 12px;
                font-size: 13px;
            }
        }
        .search-bar-container input:focus {
            border-color: #551b7a;
        }
        .search-icon-btn {
            position: absolute;
            right: 6px;
            background-color: #551b7a;
            color: #ffffff;
            border: none;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.2s;
        }
        .search-icon-btn:hover {
            background-color: #6cb090;
        }
        .search-icon-btn svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }

        .radius-select-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .radius-select-group label {
            font-size: 13px;
            font-weight: 600;
            color: #551b7a;
            white-space: nowrap;
        }
        .radius-select-group select {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 13px;
            background: #fff;
            outline: none;
            cursor: pointer;
        }
        @media (max-width: 768px) {
            .radius-select-group select {
                font-size: 12px;
                padding: 6px 8px;
            }
        }

        .events-list-title {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #111;
        }
        @media (max-width: 768px) {
            .events-list-title {
                font-size: 16px;
                margin-bottom: 8px;
            }
        }
        @media (max-width: 480px) {
            .events-list-title {
                display: none;
