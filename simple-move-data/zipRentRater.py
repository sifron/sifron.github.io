import numpy as np
import csv, sys, re

# Takes CSV file data on rental prices and gives the zip code a rank based on several critera

def main():
    zipCodes = parseRentPriceCSV()
    parseGeneralData(zipCodes)

def parseGeneralData(inputData):
    zipCodes = inputData

    fileNameIn = ["population-density-zip.csv", "unemployment-zip.csv"]
    fileNameOut = "general-data.csv"

    # POP DENSITY
    filename = "in/" + fileNameIn[0]
    with open(filename, "rb") as f:
        reader = csv.reader(f)
        try:
            # Parse csv file
            for row in reader:
                if (row[0] in zipCodes):
                    # add info
                    zipCodes[row[0]].insert(0, (float(row[1])))
                    zipCodes[row[0]].insert(1, (float(row[2])))
                    zipCodes[row[0]].insert(2, (float(row[3])))

                    # test if zip has no data
                    if (len(zipCodes[row[0]]) > 4):
                        zipCodes[row[0]].pop()
                        zipCodes[row[0]].pop()
                        zipCodes[row[0]].pop()

        except csv.Error as e:
            sys.exit('file %s, line %d: %s' % (filename, reader.line_num, e))

    # UNEMPLOYMENT
    filename = "in/" + fileNameIn[1]
    with open(filename, "rb") as f:
        reader = csv.reader(f)
        try:
            # Parse csv file
            for row in reader:
                if (row[0] in zipCodes):
                    num = 0
                    num = float(re.sub('%', '', row[1]))
                    zipCodes[row[0]].insert(3, int(num))

                    # test if zip has no data
                    if (len(zipCodes[row[0]]) > 4):
                        zipCodes[row[0]].pop()

        except csv.Error as e:
            sys.exit('file %s, line %d: %s' % (filename, reader.line_num, e))

    # write to new csv
    outName = "out/" + fileNameOut
    with open(outName, "wb") as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(["ZIP_CODE", "POPULATION", "SQUARE_MILES", "POPULATION_DENSITY", "UNEMPLOYMENT"])
        for key, value in zipCodes.items():
            writer.writerow([key, value[0], value[1], value[2], value[3]])

def getUpDownRSqr(xd, yd):
    par = np.polyfit(xd, yd, 1, full=True)
    slope = par[0][0]
    intercept=par[0][1]

    variance = np.var(yd)
    residuals = np.var([(slope*xx + intercept - yy)  for xx,yy in zip(xd,yd)])
    rSqr = np.round(1-residuals/variance, decimals=2)

    data = [slope, rSqr]
    return data

def getRentalIndex(data):

    # Split data info
    cityCompare = data[0]
    priceTrend = data[1]
    priceStability = data[2]

    rentalIndex = .5 * cityCompare + .25 * priceTrend + .25 * priceStability
    return rentalIndex

def parseRentPriceCSV():
    fileNameIn = ["studio_zip.csv", "one_zip.csv", "two_zip.csv", "three_zip.csv", "four_zip.csv", "five_zip.csv"]
    fileNameOut = ["studio.csv", "one.csv", "two.csv", "three.csv", "four.csv", "five.csv"]
    maxCityPrice = [2199, 2390, 2694.5, 3000, 3700, 4496.5]

    zipCodes = {}

    rent = {}

    # loop through all the apartment sizes
    for j in range(len(fileNameIn)):

        filename = "in/" + fileNameIn[j]
        with open(filename, "rb") as f:
            reader = csv.reader(f)
            try:
                rent = {}
                xd = []
                yd = []
                maxRentRatio = 0
                minRentRatio = 100
                maxSlope = -100
                minSlope = 100
                maxRSqr = 0
                minRSqr = 100

                # Parse csv file
                for row in reader:

                    # Only New York data
                    if (row[1] == "New York"):
                        # Only rent dollar values
                        length = len(row) - 6
                        for i in range(length):
                            if (row[i+6] != ""):
                                xd.append(i + 1)
                                yd.append(float(row[i+6]))
                        if not(row[0] in zipCodes):
                            zipCodes[row[0]] = [0, 0, 0, 0]

                    # Analyze data
                    if (xd != [] and yd != []):
                        reorder = sorted(range(len(xd)), key = lambda ii: xd[ii])
                        xd = [xd[ii] for ii in reorder]
                        yd = [yd[ii] for ii in reorder]

                        # Get Slope and R2 values
                        data = getUpDownRSqr(xd, yd)
                        slope = data[0]

                        # Find min max slope
                        if (slope > maxSlope):
                            maxSlope = slope
                        if (slope < minSlope):
                            minSlope = slope

                        rSqr = data[1]

                        # Find min max rRqr
                        if (rSqr > maxRSqr):
                            maxRSqr = rSqr
                        if (rSqr < minRSqr):
                            minRSqr = rSqr

                        # Get current rent price
                        lastIndex = len(row) - 1
                        currRent = float(row[lastIndex])

                        # Add City Median price
                        cityRent = maxCityPrice[j]

                        # Determine rent ratio
                        rentRatio = currRent / cityRent
                        if (rentRatio > maxRentRatio):
                            maxRentRatio = rentRatio
                        if (rentRatio < minRentRatio):
                            minRentRatio = rentRatio

                        newData = [rentRatio, slope, rSqr, currRent]

                        # Map data to zip code
                        rent[int(row[0])] = newData

                        # Clear list for next row
                        xd = []
                        yd = []

                # Determine rental index for each zip
                for key, value in rent.items():

                    data = value

                    # make a slope of zero the max (more constant the rent is over time the better)
                    temp = -abs(data[1])
                    maxSlope = -abs(maxSlope)
                    if (maxSlope < minSlope):
                        minSlope = maxSlope

                    # make ratio want to be lower (lower rent compared to average is better)
                    cityCompare = scaleTo100(data[0], maxRentRatio, minRentRatio, 100, 0)
                    cityCompare = 100 - cityCompare

                    # make trend want to be more positive
                    priceTrend = scaleTo100(temp, 0, minSlope, 100, 0)

                    priceStability = scaleTo100(data[2], maxRSqr, minRSqr, 100, 0)

                    values = [cityCompare, priceTrend, priceStability]

                    rent[key] = [getRentalIndex(values), data[3]]

                # write to new csv
                outName = "out/" + fileNameOut[j]
                with open(outName, "wb") as csv_file:
                    writer = csv.writer(csv_file)
                    writer.writerow(["ZIP_CODE", "RENT_INDEX", "MEDIAN_RENT"])
                    for key, value in rent.items():
                        writer.writerow([key, value[0], value[1]])

            except csv.Error as e:
                sys.exit('file %s, line %d: %s' % (filename, reader.line_num, e))

    return zipCodes

# scales a range of values to a new range
def scaleTo100(oldValue, oldMax, oldMin, newMax, newMin):

    oldRange = (oldMax - oldMin)
    newValue = (((oldValue - oldMin) * newMax) / oldRange) + newMin

    return newValue

if __name__ == "__main__":
    main()
