curl -L -o spotify-dataset.zip \
  https://www.kaggle.com/api/v1/datasets/download/yamaerenay/spotify-dataset-1921-2020-160k-tracks

echo "Unzip data"

unzip spotify-dataset.zip -d .

echo "Removing zip"

rm spotify-dataset.zip

echo "Done."
