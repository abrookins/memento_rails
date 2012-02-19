class GeographicEventsController < ApplicationController
  respond_to :json
  before_filter :authenticate_user!

  def index
    @geographic_events = current_user.geographic_events.all
    respond_with @geographic_events
  end

  def show
    @geographic_event = GeographicEvent.find(params[:id])
    respond_with @geographic_event
  end

  def create
    @geographic_event = GeographicEvent.new(params[:geographic_event])
    @geographic_event.user = current_user
    @geographic_event.save

    respond_with(@geographic_event) do |format|
      format.json do |format|
        if @geographic_event.valid? 
          render :json => @geographic_event.to_json
        else
          render :json => @geographic_event.to_json, :status => :unprocessable_entity
        end
      end
    end
  end

  def update
    @geographic_event = GeographicEvent.find(params[:id])
    @geographic_event.description = params[:description] 
    @geographic_event.title = params[:title] 
    @geographic_event.place = params[:place] 
    @geographic_event.lat = params[:lat] 
    @geographic_event.lon = params[:lon] 
    @geographic_event.date = params[:date] 

    respond_with(@map) do |format|
      format.json do |format|
        if @geographic_event.valid?
          @geographic_event.save
          render :json => @geographic_event.to_json
        else
          render :json => @geographic_event.to_json, :status => :unprocessable_entity
        end
      end
    end
  end  

  def destroy
  end
end
