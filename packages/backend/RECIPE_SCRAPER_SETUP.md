# Recipe Scraper Setup

This backend uses the Python `recipe-scrapers` library for robust recipe extraction from 600+ cooking websites.

## Prerequisites

- Python 3.7+ installed on your system
- pip (Python package manager)

## Installation

### 1. Install Python Dependencies

```bash
# Navigate to backend directory
cd packages/backend

# Install Python dependencies
pip install -r requirements.txt

# Or using pip3
pip3 install -r requirements.txt
```

### 2. Verify Installation

Test the Python scraper directly:

```bash
# On Windows
python src/services/scraper/recipe_scraper.py "https://www.allrecipes.com/recipe/282524/one-pot-crispy-chicken-and-rice/"

# On Linux/Mac
python3 src/services/scraper/recipe_scraper.py "https://www.allrecipes.com/recipe/282524/one-pot-crispy-chicken-and-rice/"
```

You should see JSON output with the scraped recipe data.

## How It Works

1. **Primary Scraper**: Node.js backend calls Python script via `child_process`
2. **Python recipe-scrapers**: Extracts data from 600+ supported sites
3. **Fallback**: If Python fails, uses cheerio-based scraper

## Supported Sites (600+)

Including but not limited to:
- AllRecipes.com
- Food Network
- Bon Appétit
- Serious Eats
- NYT Cooking
- Epicurious
- BBC Good Food
- King Arthur Baking
- Tasty
- And 590+ more!

Full list: https://github.com/hhursev/recipe-scrapers#scrapers-available-for

## Troubleshooting

### Python not found

**Windows:**
- Install Python from https://www.python.org/downloads/
- Make sure to check "Add Python to PATH" during installation

**Linux:**
```bash
sudo apt-get install python3 python3-pip
```

**Mac:**
```bash
brew install python3
```

### Permission denied error

**Linux/Mac:**
```bash
chmod +x src/services/scraper/recipe_scraper.py
```

### Module not found error

Re-install dependencies:
```bash
pip install --upgrade recipe-scrapers
```

## Docker Setup

If running in Docker, add to your Dockerfile:

```dockerfile
# Install Python
RUN apt-get update && apt-get install -y python3 python3-pip

# Install Python dependencies
COPY requirements.txt .
RUN pip3 install -r requirements.txt
```

## Testing

Test various recipe sites:

```bash
# AllRecipes
python src/services/scraper/recipe_scraper.py "https://www.allrecipes.com/recipe/158968/spinach-and-feta-turkey-burgers/"

# Food Network
python src/services/scraper/recipe_scraper.py "https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524"

# NYT Cooking (requires subscription, may not work)
python src/services/scraper/recipe_scraper.py "https://cooking.nytimes.com/recipes/1015987-chocolate-chip-cookies"
```

## Production Deployment

### Environment Variables

No special environment variables needed. The system automatically:
1. Tries Python scraper first
2. Falls back to cheerio if Python is unavailable
3. Logs warnings for debugging

### Health Check

To verify Python is available:

```bash
python --version
# or
python3 --version

# Should output: Python 3.x.x
```

### Performance

- Python scraper: ~2-5 seconds per recipe
- Cheerio fallback: ~1-3 seconds per recipe
- Timeout: 30 seconds max

## Development

### Adding Custom Parsing

Edit `src/services/scraper/recipe_scraper.py` to add custom extraction logic.

### Debugging

Enable verbose output:

```python
# In recipe_scraper.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Contributing

The `recipe-scrapers` library is open source. To add support for new sites:
https://github.com/hhursev/recipe-scrapers/blob/main/CONTRIBUTING.md
